const { expect } = require("chai");
const { deployWithConfirmation } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");
const { parseUnits } = require("ethers/lib/utils");

const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { advanceTime } = require("../helpers");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("Origin S Vault", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await sonicFixture();
  });

  const snapData = async (fixture) => {
    const { oSonic, oSonicVault, wS, user } = fixture;

    const oSonicTotalSupply = await oSonic.totalSupply();
    const oSonicTotalValue = await oSonicVault.totalValue();
    const vaultCheckBalance = await oSonicVault.checkBalance(wS.address);
    const userOSonic = await oSonic.balanceOf(user.address);
    const userWS = await wS.balanceOf(user.address);
    const vaultWS = await wS.balanceOf(oSonicVault.address);
    const queue = await oSonicVault.withdrawalQueueMetadata();

    return {
      oSonicTotalSupply,
      oSonicTotalValue,
      vaultCheckBalance,
      userOSonic,
      userWS,
      vaultWS,
      queue,
    };
  };

  const assertChangedData = async (dataBefore, delta, fixture) => {
    const { oSonic, oSonicVault, wS, user } = fixture;

    expect(await oSonic.totalSupply(), "OSonic Total Supply").to.equal(
      dataBefore.oSonicTotalSupply.add(delta.oSonicTotalSupply)
    );
    expect(await oSonicVault.totalValue(), "Vault Total Value").to.equal(
      dataBefore.oSonicTotalValue.add(delta.oSonicTotalValue)
    );
    expect(
      await oSonicVault.checkBalance(wS.address),
      "Vault Check Balance of wS"
    ).to.equal(dataBefore.vaultCheckBalance.add(delta.vaultCheckBalance));
    expect(await oSonic.balanceOf(user.address), "user's OS balance").to.equal(
      dataBefore.userOSonic.add(delta.userOSonic)
    );
    expect(await wS.balanceOf(user.address), "user's wS balance").to.equal(
      dataBefore.userWS.add(delta.userWS)
    );
    expect(
      await wS.balanceOf(oSonicVault.address),
      "Vault wS balance"
    ).to.equal(dataBefore.vaultWS.add(delta.vaultWS));

    const queueAfter = await oSonicVault.withdrawalQueueMetadata();
    expect(queueAfter.queued, "Queued").to.equal(
      dataBefore.queue.queued.add(delta.queued)
    );
    expect(queueAfter.claimable, "Claimable").to.equal(
      dataBefore.queue.claimable.add(delta.claimable)
    );
    expect(queueAfter.claimed, "Claimed").to.equal(
      dataBefore.queue.claimed.add(delta.claimed)
    );
    expect(queueAfter.nextWithdrawalIndex, "nextWithdrawalIndex").to.equal(
      dataBefore.queue.nextWithdrawalIndex.add(delta.nextWithdrawalIndex)
    );
  };

  describe("Sonic tokens", () => {
    it("Should read Origin Sonic metadata", async () => {
      const { oSonic } = fixture;

      expect(await oSonic.name()).to.equal("Origin Sonic");
      expect(await oSonic.symbol()).to.equal("OS");
      expect(await oSonic.decimals()).to.equal(18);
    });
    it("Should read Wrapped Origin Sonic metadata", async () => {
      const { wOSonic } = fixture;

      expect(await wOSonic.name()).to.equal("Wrapped OS");
      expect(await wOSonic.symbol()).to.equal("wOS");
      expect(await wOSonic.decimals()).to.equal(18);
    });

    describe("governor transfers", () => {
      const amount = parseUnits("1000", 18);
      let weth;
      beforeEach(async () => {
        const { wOSonic } = fixture;

        await deployWithConfirmation("MockWETH", []);
        weth = await ethers.getContract("MockWETH");
        await weth.mint(amount);
        await weth.transfer(wOSonic.address, amount);
      });
      it("Should allow transfer of arbitrary token by Governor", async () => {
        const { wOSonic, governor } = fixture;

        await wOSonic.connect(governor).transferToken(weth.address, amount);
        await expect(governor).has.a.balanceOf(amount, weth);
      });
      it("Should not allow transfer of arbitrary token by non-Governor", async () => {
        const { wOSonic, nick } = fixture;

        // Naughty Nick
        await expect(
          wOSonic.connect(nick).transferToken(weth.address, amount)
        ).to.be.revertedWith("Caller is not the Governor");
      });
      it("Should not allow transfer of Origin Sonic token by governor", async () => {
        const { oSonic, wOSonic, governor } = fixture;

        await expect(
          wOSonic.connect(governor).transferToken(oSonic.address, amount)
        ).to.be.revertedWith("Cannot collect core asset");
      });
    });
  });

  describe("Vault operations", () => {
    it("Should mint with wS", async () => {
      const { oSonicVault, wS, nick } = fixture;

      const fixtureWithUser = { ...fixture, user: nick };
      const dataBefore = await snapData(fixtureWithUser);

      const mintAmount = parseUnits("1", 18);
      const minOS = parseUnits("0.8", 18);

      await wS.connect(nick).approve(oSonicVault.address, mintAmount);

      const tx = await oSonicVault
        .connect(nick)
        .mint(wS.address, mintAmount, minOS);

      await expect(tx)
        .to.emit(oSonicVault, "Mint")
        .withArgs(nick.address, mintAmount);

      await assertChangedData(
        dataBefore,
        {
          oSonicTotalSupply: mintAmount,
          oSonicTotalValue: mintAmount,
          vaultCheckBalance: mintAmount,
          userOSonic: mintAmount,
          userWS: mintAmount.mul(-1),
          vaultWS: mintAmount,
          queued: 0,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });

    it("Should request withdraw from Vault", async () => {
      const { oSonicVault, wS, nick } = fixture;

      // Mint some OSonic
      const mintAmount = parseUnits("100", 18);
      await wS.connect(nick).approve(oSonicVault.address, mintAmount);
      await oSonicVault.connect(nick).mint(wS.address, mintAmount, 0);

      const fixtureWithUser = { ...fixture, user: nick };
      const dataBefore = await snapData(fixtureWithUser);

      const withdrawAmount = parseUnits("90", 18);
      const tx = await oSonicVault
        .connect(nick)
        .requestWithdrawal(withdrawAmount);

      await expect(tx)
        .to.emit(oSonicVault, "WithdrawalRequested")
        .withArgs(nick.address, 0, withdrawAmount, withdrawAmount);

      const deltaAmount = withdrawAmount.mul(-1);
      await assertChangedData(
        dataBefore,
        {
          oSonicTotalSupply: deltaAmount,
          oSonicTotalValue: deltaAmount,
          vaultCheckBalance: deltaAmount,
          userOSonic: deltaAmount,
          userWS: 0,
          vaultWS: 0,
          queued: withdrawAmount,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 1,
        },
        fixtureWithUser
      );
    });

    it("Should claim withdraw from Vault", async () => {
      const { oSonicVault, wS, nick } = fixture;

      // Mint some OSonic
      const mintAmount = parseUnits("100", 18);
      await wS.connect(nick).approve(oSonicVault.address, mintAmount);
      await oSonicVault.connect(nick).mint(wS.address, mintAmount, 0);
      const withdrawAmount = parseUnits("90", 18);
      await oSonicVault.connect(nick).requestWithdrawal(withdrawAmount);

      const fixtureWithUser = { ...fixture, user: nick };
      const dataBefore = await snapData(fixtureWithUser);

      await advanceTime(86400); // 1 day

      const withdrawalId = 0;
      const tx = await oSonicVault.connect(nick).claimWithdrawal(withdrawalId);

      await expect(tx)
        .to.emit(oSonicVault, "WithdrawalClaimed")
        .withArgs(nick.address, withdrawalId, withdrawAmount);

      await assertChangedData(
        dataBefore,
        {
          oSonicTotalSupply: 0,
          oSonicTotalValue: 0,
          vaultCheckBalance: 0,
          userOSonic: 0,
          userWS: withdrawAmount,
          vaultWS: withdrawAmount.mul(-1),
          queued: 0,
          claimable: withdrawAmount,
          claimed: withdrawAmount,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });

    it("Should claim multiple withdrawal from Vault", async () => {
      const { oSonicVault, wS, nick } = fixture;

      // Mint some OSonic
      const mintAmount = parseUnits("100", 18);
      await wS.connect(nick).approve(oSonicVault.address, mintAmount);
      await oSonicVault.connect(nick).mint(wS.address, mintAmount, 0);
      const withdrawAmount1 = parseUnits("10", 18);
      const withdrawAmount2 = parseUnits("20", 18);
      const withdrawAmount = withdrawAmount1.add(withdrawAmount2);
      await oSonicVault.connect(nick).requestWithdrawal(withdrawAmount1);
      await oSonicVault.connect(nick).requestWithdrawal(withdrawAmount2);

      const fixtureWithUser = { ...fixture, user: nick };
      const dataBefore = await snapData(fixtureWithUser);

      await advanceTime(86400); // 1 day

      // Claim both withdrawals
      const tx = await oSonicVault.connect(nick).claimWithdrawals([0, 1]);

      await expect(tx)
        .to.emit(oSonicVault, "WithdrawalClaimed")
        .withArgs(nick.address, 0, withdrawAmount1);
      await expect(tx)
        .to.emit(oSonicVault, "WithdrawalClaimed")
        .withArgs(nick.address, 1, withdrawAmount2);

      await assertChangedData(
        dataBefore,
        {
          oSonicTotalSupply: 0,
          oSonicTotalValue: 0,
          vaultCheckBalance: 0,
          userOSonic: 0,
          userWS: withdrawAmount,
          vaultWS: withdrawAmount.mul(-1),
          queued: 0,
          claimable: withdrawAmount,
          claimed: withdrawAmount,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });

    it("Should not support redeem", async () => {
      const { oSonicVault, wS, nick } = fixture;

      const tx = oSonicVault.connect(nick).redeem(wS.address, 1);
      await expect(tx).to.be.revertedWith("unsupported function");
    });
  });

  describe("Administer Sonic Staking Strategy", function () {
    it("Should support Wrapped S asset", async () => {
      const { sonicStakingStrategy, wS } = fixture;

      expect(await sonicStakingStrategy.supportsAsset(wS.address)).to.eq(true);
    });

    it("Should allow governor to set validator registrator", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      // generate a wallet
      const newRegistrator = ethers.Wallet.createRandom();

      const tx = await sonicStakingStrategy
        .connect(governor)
        .setRegistrator(newRegistrator.address);

      await expect(tx)
        .to.emit(sonicStakingStrategy, "RegistratorChanged")
        .withArgs(newRegistrator.address);
      expect(await sonicStakingStrategy.validatorRegistrator()).to.eq(
        newRegistrator.address
      );
    });

    it("Should not allow set validator registrator by non-Governor", async () => {
      const { sonicStakingStrategy, strategist, nick, rafael } = fixture;

      for (const signer of [strategist, nick, rafael]) {
        await expect(
          sonicStakingStrategy.connect(signer).setRegistrator(signer.address)
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow governor to add supported validator", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      expect(await sonicStakingStrategy.supportedValidatorsLength()).to.eq(
        0,
        "Validators length before"
      );
      expect(await sonicStakingStrategy.isSupportedValidator(98)).to.eq(false);

      // Add two validators
      const tx1 = await sonicStakingStrategy
        .connect(governor)
        .supportValidator(98);
      const tx2 = await sonicStakingStrategy
        .connect(governor)
        .supportValidator(99);

      await expect(tx1)
        .to.emit(sonicStakingStrategy, "SupportedValidator")
        .withArgs(98);
      await expect(tx2)
        .to.emit(sonicStakingStrategy, "SupportedValidator")
        .withArgs(99);

      expect(await sonicStakingStrategy.supportedValidators(0)).to.eq(98);
      expect(await sonicStakingStrategy.supportedValidators(1)).to.eq(99);
      expect(await sonicStakingStrategy.supportedValidatorsLength()).to.eq(
        2,
        "Validators length after"
      );
      expect(await sonicStakingStrategy.isSupportedValidator(98)).to.eq(true);
    });

    it("Should not allow adding a supported validator twice", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      // Add validators
      await sonicStakingStrategy.connect(governor).supportValidator(98);

      // Try adding again
      const tx = sonicStakingStrategy.connect(governor).supportValidator(98);

      await expect(tx).to.revertedWith("Validator already supported");
    });

    it("Should not allow add supported validator by non-Governor", async () => {
      const { sonicStakingStrategy, strategist, nick, rafael } = fixture;

      for (const signer of [strategist, nick, rafael]) {
        await expect(
          sonicStakingStrategy.connect(signer).supportValidator(99)
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow governor to unsupport validator", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      // Add three validators
      await sonicStakingStrategy.connect(governor).supportValidator(95);
      await sonicStakingStrategy.connect(governor).supportValidator(98);
      await sonicStakingStrategy.connect(governor).supportValidator(99);

      expect(await sonicStakingStrategy.supportedValidatorsLength()).to.eq(
        3,
        "Validators length before"
      );
      expect(await sonicStakingStrategy.isSupportedValidator(98)).to.eq(true);

      const tx = await sonicStakingStrategy
        .connect(governor)
        .unsupportValidator(98);

      await expect(tx)
        .to.emit(sonicStakingStrategy, "UnsupportedValidator")
        .withArgs(98);

      expect(await sonicStakingStrategy.supportedValidators(0)).to.eq(95);
      expect(await sonicStakingStrategy.supportedValidators(1)).to.eq(99);
      expect(await sonicStakingStrategy.supportedValidatorsLength()).to.eq(
        2,
        "Validators length after"
      );
      expect(await sonicStakingStrategy.isSupportedValidator(95)).to.eq(true);
      expect(await sonicStakingStrategy.isSupportedValidator(98)).to.eq(false);
      expect(await sonicStakingStrategy.isSupportedValidator(99)).to.eq(true);
    });

    it("Should not allow unsupport validator by non-Governor", async () => {
      const { governor, sonicStakingStrategy, strategist, nick, rafael } =
        fixture;

      // Add validator
      await sonicStakingStrategy.connect(governor).supportValidator(95);

      for (const signer of [strategist, nick, rafael]) {
        await expect(
          sonicStakingStrategy.connect(signer).unsupportValidator(95)
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should not allow unsupport of an unsupported validator", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      expect(await sonicStakingStrategy.isSupportedValidator(90)).to.eq(false);

      const tx = sonicStakingStrategy.connect(governor).unsupportValidator(90);

      await expect(tx).to.revertedWith("Validator not supported");

      expect(await sonicStakingStrategy.isSupportedValidator(90)).to.eq(false);
    });

    describe("Setting default validator registrator", function () {
      let newRegistrator, newRegistratorSigner;
      beforeEach(async () => {
        const { sonicStakingStrategy, governor } = fixture;

        newRegistrator = ethers.Wallet.createRandom();
        newRegistratorSigner = await impersonateAndFund(newRegistrator.address);
        await sonicStakingStrategy
          .connect(governor)
          .setRegistrator(newRegistrator.address);
      });

      it("Should allow setting a default validator", async () => {
        const { sonicStakingStrategy, governor, strategist } = fixture;
        await sonicStakingStrategy.connect(governor).supportValidator(95);
        await sonicStakingStrategy.connect(governor).supportValidator(96);

        const tx = await sonicStakingStrategy
          .connect(newRegistratorSigner)
          .setDefaultValidatorId(95);

        expect(tx)
          .to.emit(sonicStakingStrategy, "DefaultValidatorIdChanged")
          .withArgs(95);

        expect(await sonicStakingStrategy.defaultValidatorId()).to.equal(95);

        await sonicStakingStrategy
          .connect(strategist)
          .setDefaultValidatorId(96);
        expect(await sonicStakingStrategy.defaultValidatorId()).to.equal(96);
      });

      it("Should not allow setting a default validator when one is not supported", async () => {
        const { sonicStakingStrategy } = fixture;

        await expect(
          sonicStakingStrategy
            .connect(newRegistratorSigner)
            .setDefaultValidatorId(95)
        ).to.be.revertedWith("Validator not supported");
      });

      it("Should not allow setting a default validator by non registrator/strategist account", async () => {
        const { sonicStakingStrategy, governor, nick } = fixture;
        await sonicStakingStrategy.connect(governor).supportValidator(95);

        await expect(
          sonicStakingStrategy.connect(nick).setDefaultValidatorId(95)
        ).to.be.revertedWith("Caller is not the Registrator or Strategist");
      });
    });
  });

  describe("Unsupported strategy functions", function () {
    it("Should not support collectRewardTokens", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      const tx = sonicStakingStrategy.connect(governor).collectRewardTokens();

      await expect(tx).to.be.revertedWith("unsupported function");
    });

    it("Should not support setPTokenAddress", async () => {
      const { sonicStakingStrategy, governor, wS, nick } = fixture;

      const tx = sonicStakingStrategy
        .connect(governor)
        .setPTokenAddress(wS.address, nick.address);

      await expect(tx).to.be.revertedWith("unsupported function");
    });

    it("Should not support removePToken", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      const tx = sonicStakingStrategy.connect(governor).removePToken(1);

      await expect(tx).to.be.revertedWith("unsupported function");
    });
  });

  describe("Other function checks", function () {
    it("Should not allow checkBalance with incorrect asset", async () => {
      const { sonicStakingStrategy, nick } = fixture;

      const tx = sonicStakingStrategy.checkBalance(nick.address);
      await expect(tx).to.be.revertedWith("Unsupported asset");
    });
  });
});
