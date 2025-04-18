const { createFixtureLoader } = require("../_fixture");
const { defaultPlumeFixture } = require("../_fixture-plume");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { oethUnits, advanceTime } = require("../helpers");
const { deployWithConfirmation } = require("../../utils/deploy");

const plumeFixture = createFixtureLoader(defaultPlumeFixture);

describe("ForkTest: OETHp Vault", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await plumeFixture();
  });

  async function _mint(signer) {
    const { weth, oethpVault, _mintWETH } = fixture;
    await _mintWETH(signer, oethUnits("1"));
    await weth.connect(signer).approve(oethpVault.address, oethUnits("1"));
    await oethpVault.connect(signer).mint(weth.address, oethUnits("1"), "0");
  }

  describe("Mint & Permissioned redeems", function () {
    it("Should allow anyone to mint", async () => {
      const { nick, weth, oethp, oethpVault } = fixture;

      // issue a pre-mint so that Dripper collect gets called so next mint
      // doesn't include dripper funds
      await _mint(nick);
      await oethpVault.rebase();

      const vaultBalanceBefore = await weth.balanceOf(oethpVault.address);
      const userBalanceBefore = await oethp.balanceOf(nick.address);
      const totalSupplyBefore = await oethp.totalSupply();

      await _mint(nick);

      const vaultBalanceAfter = await weth.balanceOf(oethpVault.address);
      const userBalanceAfter = await oethp.balanceOf(nick.address);
      const totalSupplyAfter = await oethp.totalSupply();

      expect(totalSupplyAfter).to.approxEqual(
        totalSupplyBefore.add(oethUnits("1"))
      );
      expect(userBalanceAfter).to.approxEqual(
        userBalanceBefore.add(oethUnits("1"))
      );
      expect(vaultBalanceAfter).to.approxEqualTolerance(
        vaultBalanceBefore.add(oethUnits("1")),
        0.1
      );
    });

    it("Should allow only Strategist to redeem", async () => {
      const { strategist, oethpVault, oethp, weth, rafael } = fixture;

      // Add WETH liquidity to allow redeem
      await weth
        .connect(rafael)
        .transfer(oethpVault.address, oethUnits("10000"));

      await oethpVault.rebase();
      await _mint(strategist);

      const vaultBalanceBefore = await weth.balanceOf(oethpVault.address);
      const userBalanceBefore = await oethp.balanceOf(strategist.address);
      const totalSupplyBefore = await oethp.totalSupply();

      await oethpVault.connect(strategist).redeem(oethUnits("1"), "0");

      const vaultBalanceAfter = await weth.balanceOf(oethpVault.address);
      const userBalanceAfter = await oethp.balanceOf(strategist.address);
      const totalSupplyAfter = await oethp.totalSupply();

      expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(oethUnits("1")));
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(oethUnits("1")));
      expect(vaultBalanceAfter).to.equal(
        vaultBalanceBefore.sub(oethUnits("1"))
      );
    });

    it("Should allow only Governor to redeem", async () => {
      const { governor, oethpVault, oethp, weth, rafael } = fixture;

      // Add WETH liquidity to allow redeem
      await weth
        .connect(rafael)
        .transfer(oethpVault.address, oethUnits("10000"));

      await oethpVault.rebase();
      await _mint(governor);

      const vaultBalanceBefore = await weth.balanceOf(oethpVault.address);
      const userBalanceBefore = await oethp.balanceOf(governor.address);
      const totalSupplyBefore = await oethp.totalSupply();

      await oethpVault.connect(governor).redeem(oethUnits("1"), "0");

      const vaultBalanceAfter = await weth.balanceOf(oethpVault.address);
      const userBalanceAfter = await oethp.balanceOf(governor.address);
      const totalSupplyAfter = await oethp.totalSupply();

      expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(oethUnits("1")));
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(oethUnits("1")));
      expect(vaultBalanceAfter).to.equal(
        vaultBalanceBefore.sub(oethUnits("1"))
      );
    });

    it("No one else can redeem", async () => {
      const { rafael, nick, oethpVault } = fixture;

      await oethpVault.rebase();

      for (const signer of [rafael, nick]) {
        await _mint(signer);
        await expect(
          oethpVault.connect(signer).redeem(oethUnits("1"), "0")
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      }
    });
  });

  describe("Async withdrawals", function () {
    it("Should allow 1:1 async withdrawals", async () => {
      const { rafael, governor, oethpVault, weth } = fixture;

      // Add WETH liquidity to allow withdrawal
      await weth
        .connect(rafael)
        .transfer(oethpVault.address, oethUnits("10000"));

      const delayPeriod = await oethpVault.withdrawalClaimDelay();

      if (delayPeriod == 0) {
        // Temporarily set to 10m if disabled
        await oethpVault.connect(governor).setWithdrawalClaimDelay(
          10 * 60 // 10 mins
        );
      }

      const { nextWithdrawalIndex: requestId } =
        await oethpVault.withdrawalQueueMetadata();

      // Rafael mints 1 superOETHp
      await _mint(rafael);

      // Rafael places an async withdrawal request
      await oethpVault.connect(rafael).requestWithdrawal(oethUnits("1"));

      // ... and tries to claim it after 1d
      await advanceTime(delayPeriod);
      await oethpVault.connect(rafael).claimWithdrawal(requestId);
    });

    it("Should not allow withdraw before claim delay", async () => {
      const { rafael, governor, oethpVault } = fixture;

      const delayPeriod = await oethpVault.withdrawalClaimDelay();

      if (delayPeriod == 0) {
        // Temporarily set to 10m if disabled
        await oethpVault.connect(governor).setWithdrawalClaimDelay(
          10 * 60 // 10 mins
        );
      }

      const { nextWithdrawalIndex: requestId } =
        await oethpVault.withdrawalQueueMetadata();

      // Rafael mints 1 superOETHp
      await _mint(rafael);

      // Rafael places an async withdrawal request
      await oethpVault.connect(rafael).requestWithdrawal(oethUnits("1"));

      // ... and tries to claim before the withdraw period
      const tx = oethpVault.connect(rafael).claimWithdrawal(requestId);
      await expect(tx).to.be.revertedWith("Claim delay not met");
    });

    it("Should enforce claim delay limits", async () => {
      const { governor, oethpVault } = fixture;

      // lower bound
      await oethpVault.connect(governor).setWithdrawalClaimDelay(
        10 * 60 // 10 mins
      );
      expect(await oethpVault.withdrawalClaimDelay()).to.eq(10 * 60);

      // upper bound
      await oethpVault.connect(governor).setWithdrawalClaimDelay(
        15 * 24 * 60 * 60 // 7d
      );
      expect(await oethpVault.withdrawalClaimDelay()).to.eq(15 * 24 * 60 * 60);

      // below lower bound
      let tx = oethpVault.connect(governor).setWithdrawalClaimDelay(
        9 * 60 + 59 // 9 mins 59 sec
      );
      await expect(tx).to.be.revertedWith("Invalid claim delay period");

      // above upper bound
      tx = oethpVault.connect(governor).setWithdrawalClaimDelay(
        15 * 24 * 60 * 60 + 1 // 7d + 1s
      );
      await expect(tx).to.be.revertedWith("Invalid claim delay period");
    });

    it("Should allow governor to disable withdrawals", async () => {
      const { governor, oethpVault, rafael } = fixture;

      // Disable it
      await oethpVault.connect(governor).setWithdrawalClaimDelay(0);
      expect(await oethpVault.withdrawalClaimDelay()).to.eq(0);

      // No one can make requests
      const tx = oethpVault.connect(rafael).requestWithdrawal(oethUnits("1"));
      await expect(tx).to.be.revertedWith("Async withdrawals not enabled");
    });

    it("Should not allow anyone else to disable withdrawals", async () => {
      const { oethpVault, rafael } = fixture;
      // TODO: Add strategist to the list later
      for (const signer of [rafael]) {
        const tx = oethpVault.connect(signer).setWithdrawalClaimDelay(0);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });

  describe("Mint Whitelist", function () {
    it("Should allow a strategy to be added to the whitelist", async () => {
      const { oethpVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethpVault.connect(governor).approveStrategy(addresses.dead);

      const tx = oethpVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);

      await expect(tx).to.emit(oethpVault, "StrategyAddedToMintWhitelist");
      expect(await oethpVault.isMintWhitelistedStrategy(addresses.dead)).to.be
        .true;
    });

    it("Should allow a strategy to be removed from the whitelist", async () => {
      const { oethpVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethpVault.connect(governor).approveStrategy(addresses.dead);
      await oethpVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);

      // Remove it
      const tx = oethpVault
        .connect(governor)
        .removeStrategyFromMintWhitelist(addresses.dead);

      await expect(tx).to.emit(oethpVault, "StrategyRemovedFromMintWhitelist");
      expect(await oethpVault.isMintWhitelistedStrategy(addresses.dead)).to.be
        .false;
    });

    it("Should not allow non-governor to add to whitelist", async () => {
      const { oethpVault, rafael } = fixture;
      const tx = oethpVault
        .connect(rafael)
        .addStrategyToMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should not allow non-governor to remove from whitelist", async () => {
      const { oethpVault, rafael } = fixture;
      const tx = oethpVault
        .connect(rafael)
        .removeStrategyFromMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should not allow adding unapproved strategy", async () => {
      const { oethpVault, governor } = fixture;
      const tx = oethpVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Strategy not approved");
    });

    it("Should not whitelist if already whitelisted", async () => {
      const { oethpVault, governor } = fixture;

      await oethpVault.connect(governor).approveStrategy(addresses.dead);
      await oethpVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);

      const tx = oethpVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Already whitelisted");
    });

    it("Should revert when removing unwhitelisted strategy", async () => {
      const { oethpVault, governor } = fixture;

      const tx = oethpVault
        .connect(governor)
        .removeStrategyFromMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Not whitelisted");
    });
  });

  describe("Mint & Burn For Strategy", function () {
    let strategySigner, mockStrategy;

    beforeEach(async () => {
      const { oethpVault, governor } = fixture;

      mockStrategy = await deployWithConfirmation("MockStrategy");

      await oethpVault.connect(governor).approveStrategy(mockStrategy.address);
      await oethpVault
        .connect(governor)
        .addStrategyToMintWhitelist(mockStrategy.address);
      strategySigner = await impersonateAndFund(mockStrategy.address);
    });

    it("Should allow a whitelisted strategy to mint and burn", async () => {
      const { oethpVault, oethp } = fixture;

      await oethpVault.rebase();

      const amount = oethUnits("1");

      const supplyBefore = await oethp.totalSupply();
      await oethpVault.connect(strategySigner).mintForStrategy(amount);
      expect(await oethp.balanceOf(mockStrategy.address)).to.eq(amount);
      expect(await oethp.totalSupply()).to.eq(supplyBefore.add(amount));

      await oethpVault.connect(strategySigner).burnForStrategy(amount);
      expect(await oethp.balanceOf(mockStrategy.address)).to.eq(0);
      expect(await oethp.totalSupply()).to.eq(supplyBefore);
    });

    it("Should not allow a non-supported strategy to mint", async () => {
      const { oethpVault, governor } = fixture;

      const amount = oethUnits("1");

      const tx = oethpVault.connect(governor).mintForStrategy(amount);
      await expect(tx).to.be.revertedWith("Unsupported strategy");
    });

    it("Should not allow a non-supported strategy to burn", async () => {
      const { oethpVault, governor } = fixture;

      const amount = oethUnits("1");

      const tx = oethpVault.connect(governor).burnForStrategy(amount);
      await expect(tx).to.be.revertedWith("Unsupported strategy");
    });

    it("Should not allow a non-white listed strategy to mint", async () => {
      const { oethpVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethpVault.connect(governor).approveStrategy(addresses.dead);

      const amount = oethUnits("1");

      const tx = oethpVault
        .connect(await impersonateAndFund(addresses.dead))
        .mintForStrategy(amount);
      await expect(tx).to.be.revertedWith("Not whitelisted strategy");
    });

    it("Should not allow a non-white listed strategy to burn", async () => {
      const { oethpVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethpVault.connect(governor).approveStrategy(addresses.dead);

      const amount = oethUnits("1");

      const tx = oethpVault
        .connect(await impersonateAndFund(addresses.dead))
        .burnForStrategy(amount);
      await expect(tx).to.be.revertedWith("Not whitelisted strategy");
    });
  });
});
