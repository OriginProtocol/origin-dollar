const { expect } = require("chai");
const hre = require("hardhat");

const { createFixtureLoader, oethDefaultFixture } = require("../_fixture");
const { parseUnits } = require("ethers/lib/utils");
const { deployWithConfirmation } = require("../../utils/deploy");
const { oethUnits, advanceTime } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const addresses = require("../../utils/addresses");

const oethFixture = createFixtureLoader(oethDefaultFixture);

describe("OETH Vault", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await oethFixture();
  });

  const snapData = async (fixture) => {
    const { oeth, oethVault, weth, user } = fixture;

    const oethTotalSupply = await oeth.totalSupply();
    const oethTotalValue = await oethVault.totalValue();
    const vaultCheckBalance = await oethVault.checkBalance(weth.address);
    const userOeth = await oeth.balanceOf(user.address);
    const userWeth = await weth.balanceOf(user.address);
    const vaultWeth = await weth.balanceOf(oethVault.address);
    const queue = await oethVault.withdrawalQueueMetadata();

    return {
      oethTotalSupply,
      oethTotalValue,
      vaultCheckBalance,
      userOeth,
      userWeth,
      vaultWeth,
      queue,
    };
  };

  const assertChangedData = async (dataBefore, delta, fixture) => {
    const { oeth, oethVault, weth, user } = fixture;

    expect(await oeth.totalSupply(), "OETH Total Supply").to.equal(
      dataBefore.oethTotalSupply.add(delta.oethTotalSupply)
    );
    expect(await oethVault.totalValue(), "Vault Total Value").to.equal(
      dataBefore.oethTotalValue.add(delta.oethTotalValue)
    );
    expect(
      await oethVault.checkBalance(weth.address),
      "Vault Check Balance of WETH"
    ).to.equal(dataBefore.vaultCheckBalance.add(delta.vaultCheckBalance));
    expect(await oeth.balanceOf(user.address), "user's OETH balance").to.equal(
      dataBefore.userOeth.add(delta.userOeth)
    );
    expect(await weth.balanceOf(user.address), "user's WETH balance").to.equal(
      dataBefore.userWeth.add(delta.userWeth)
    );
    expect(
      await weth.balanceOf(oethVault.address),
      "Vault WETH balance"
    ).to.equal(dataBefore.vaultWeth.add(delta.vaultWeth));

    const queueAfter = await oethVault.withdrawalQueueMetadata();
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

  describe("Mint", () => {
    it("Should mint with WETH", async () => {
      const { oethVault, weth, josh } = fixture;

      const fixtureWithUser = { ...fixture, user: josh };
      const dataBefore = await snapData(fixtureWithUser);

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      await weth.connect(josh).approve(oethVault.address, amount);

      const tx = await oethVault
        .connect(josh)
        .mint(weth.address, amount, minOeth);

      await expect(tx)
        .to.emit(oethVault, "Mint")
        .withArgs(josh.address, amount);

      await assertChangedData(
        dataBefore,
        {
          oethTotalSupply: amount,
          oethTotalValue: amount,
          vaultCheckBalance: amount,
          userOeth: amount,
          userWeth: amount.mul(-1),
          vaultWeth: amount,
          queued: 0,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });

    it("Fail to mint with any other asset", async () => {
      const { oethVault, frxETH, stETH, reth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      for (const asset of [frxETH, stETH, reth]) {
        await asset.connect(josh).approve(oethVault.address, amount);
        const tx = oethVault.connect(josh).mint(asset.address, amount, minOeth);

        await expect(tx).to.be.revertedWith("Unsupported asset for minting");
      }
    });

    it("Fail to mint if amount is zero", async () => {
      const { oethVault, weth, josh } = fixture;

      const tx = oethVault.connect(josh).mint(weth.address, "0", "0");
      await expect(tx).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Fail to mint if capital is paused", async () => {
      const { oethVault, weth, governor } = fixture;

      await oethVault.connect(governor).pauseCapital();
      expect(await oethVault.capitalPaused()).to.equal(true);

      const tx = oethVault
        .connect(governor)
        .mint(weth.address, oethUnits("10"), "0");
      await expect(tx).to.be.revertedWith("Capital paused");
    });

    it("Should allocate if beyond allocate threshold", async () => {
      const { oethVault, weth, domen, governor } = fixture;

      const mockStrategy = await deployWithConfirmation("MockStrategy");
      await oethVault.connect(governor).approveStrategy(mockStrategy.address);
      await oethVault
        .connect(governor)
        .setAssetDefaultStrategy(weth.address, mockStrategy.address);

      const fixtureWithUser = { ...fixture, user: domen };
      const dataBefore = await snapData(fixtureWithUser);

      // Mint some WETH
      await weth.connect(domen).approve(oethVault.address, oethUnits("10000"));
      const mintAmount = oethUnits("100");
      await oethVault.connect(domen).mint(weth.address, mintAmount, "0");

      expect(await weth.balanceOf(mockStrategy.address)).to.eq(
        mintAmount,
        "Strategy has the WETH"
      );

      await assertChangedData(
        dataBefore,
        {
          oethTotalSupply: mintAmount,
          oethTotalValue: mintAmount,
          vaultCheckBalance: mintAmount,
          userOeth: mintAmount,
          userWeth: mintAmount.mul(-1),
          vaultWeth: 0,
          queued: 0,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });
  });

  describe("Redeem", () => {
    it("Should return only WETH in redeem calculations", async () => {
      const { oethVault, weth } = fixture;

      const outputs = await oethVault.calculateRedeemOutputs(
        oethUnits("1234.43")
      );

      const assets = await oethVault.getAllAssets();

      expect(assets.length).to.equal(outputs.length);

      for (let i = 0; i < assets.length; i++) {
        expect(outputs[i]).to.equal(
          assets[i] == weth.address ? oethUnits("1234.43") : "0"
        );
      }
    });

    it("Fail to calculateRedeemOutputs if WETH index isn't cached", async () => {
      const { frxETH, weth } = fixture;

      await deployWithConfirmation("MockOETHVault", [weth.address]);
      const mockVault = await hre.ethers.getContract("MockOETHVault");

      await mockVault.supportAsset(frxETH.address);

      const tx = mockVault.calculateRedeemOutputs(oethUnits("12343"));
      await expect(tx).to.be.revertedWith("WETH Asset index not cached");
    });

    it("Should update total supply correctly without redeem fee", async () => {
      const { oethVault, oeth, weth, daniel } = fixture;
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");

      const userBalanceBefore = await weth.balanceOf(daniel.address);
      const vaultBalanceBefore = await weth.balanceOf(oethVault.address);
      const supplyBefore = await oeth.totalSupply();

      await oethVault.connect(daniel).redeem(oethUnits("10"), "0");

      const userBalanceAfter = await weth.balanceOf(daniel.address);
      const vaultBalanceAfter = await weth.balanceOf(oethVault.address);
      const supplyAfter = await oeth.totalSupply();

      // Make sure the total supply went down
      expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(oethUnits("10"));
      expect(vaultBalanceBefore.sub(vaultBalanceAfter)).to.eq(oethUnits("10"));
      expect(supplyBefore.sub(supplyAfter)).to.eq(oethUnits("10"));
    });

    it("Should update total supply correctly with redeem fee", async () => {
      const { oethVault, oeth, weth, daniel } = fixture;
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");

      await oethVault
        .connect(await impersonateAndFund(await oethVault.governor()))
        .setRedeemFeeBps(100);

      const userBalanceBefore = await weth.balanceOf(daniel.address);
      const vaultBalanceBefore = await weth.balanceOf(oethVault.address);
      const supplyBefore = await oeth.totalSupply();

      await oethVault.connect(daniel).redeem(oethUnits("10"), "0");

      const userBalanceAfter = await weth.balanceOf(daniel.address);
      const vaultBalanceAfter = await weth.balanceOf(oethVault.address);
      const supplyAfter = await oeth.totalSupply();

      // Make sure the total supply went down
      expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(
        oethUnits("10").sub(oethUnits("0.1"))
      );
      expect(vaultBalanceBefore.sub(vaultBalanceAfter)).to.eq(
        oethUnits("10").sub(oethUnits("0.1"))
      );
      expect(supplyBefore.sub(supplyAfter)).to.eq(oethUnits("10"));
    });

    it("Fail to redeem if not enough liquidity available in the vault", async () => {
      const { oethVault, weth, domen, governor } = fixture;

      const mockStrategy = await deployWithConfirmation("MockStrategy");
      await oethVault.connect(governor).approveStrategy(mockStrategy.address);
      await oethVault
        .connect(governor)
        .setAssetDefaultStrategy(weth.address, mockStrategy.address);

      // Mint some WETH
      await weth.connect(domen).approve(oethVault.address, oethUnits("10000"));
      await oethVault.connect(domen).mint(weth.address, oethUnits("100"), "0");

      // Mint a small amount that won't get allocated to the strategy
      await oethVault.connect(domen).mint(weth.address, oethUnits("1.23"), "0");

      // Withdraw something more than what the Vault holds
      const tx = oethVault.connect(domen).redeem(oethUnits("12.55"), "0");

      await expect(tx).to.revertedWith("Liquidity error");
    });

    it("Should redeem zero amount without revert", async () => {
      const { oethVault, daniel } = fixture;

      await oethVault.connect(daniel).redeem(0, 0);
    });

    it("Fail to redeem if not enough liquidity", async () => {
      const { oethVault, daniel } = fixture;
      const tx = oethVault
        .connect(daniel)
        .redeem(oethUnits("1023232323232"), "0");
      await expect(tx).to.be.revertedWith("Liquidity error");
    });
    it("Should allow every user to redeem", async () => {
      const { oethVault, weth, daniel } = fixture;
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");

      await oethVault.connect(daniel).redeem(oethUnits("10"), oethUnits("0"));

      await expect(await weth.balanceOf(oethVault.address)).to.equal(0);
    });
  });

  describe("Config", () => {
    it("Should allow caching WETH index", async () => {
      const { oethVault, weth, governor } = fixture;

      await oethVault.connect(governor).cacheWETHAssetIndex();

      const index = (await oethVault.wethAssetIndex()).toNumber();

      const assets = await oethVault.getAllAssets();

      expect(assets[index]).to.equal(weth.address);
    });

    it("Fail to allow anyone other than Governor to change cached index", async () => {
      const { oethVault, strategist } = fixture;

      const tx = oethVault.connect(strategist).cacheWETHAssetIndex();
      await expect(tx).to.be.revertedWith("Caller is not the Governor");
    });

    it("Fail to cacheWETHAssetIndex if WETH is not a supported asset", async () => {
      const { frxETH, weth } = fixture;
      const { deployerAddr } = await hre.getNamedAccounts();
      const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

      await deployWithConfirmation("MockOETHVault", [weth.address]);
      const mockVault = await hre.ethers.getContract("MockOETHVault");

      await mockVault.supportAsset(frxETH.address);

      const tx = mockVault.connect(sDeployer).cacheWETHAssetIndex();
      await expect(tx).to.be.revertedWith("Invalid WETH Asset Index");
    });

    it("Should return all strategies", async () => {
      // Mostly to increase coverage

      const { oethVault, weth, governor } = fixture;

      // Empty list
      await expect((await oethVault.getAllStrategies()).length).to.equal(0);

      // Add a strategy
      await oethVault.connect(governor).approveStrategy(weth.address);

      // Check the strategy list
      await expect(await oethVault.getAllStrategies()).to.deep.equal([
        weth.address,
      ]);
    });
  });

  describe("Remove Asset", () => {
    it("Should allow removing a single asset", async () => {
      const { oethVault, frxETH, governor } = fixture;

      const vaultAdmin = await ethers.getContractAt(
        "OETHVaultAdmin",
        oethVault.address
      );
      const assetCount = (await oethVault.getAssetCount()).toNumber();

      const tx = await oethVault.connect(governor).removeAsset(frxETH.address);

      await expect(tx)
        .to.emit(vaultAdmin, "AssetRemoved")
        .withArgs(frxETH.address);
      await expect(tx)
        .to.emit(vaultAdmin, "AssetDefaultStrategyUpdated")
        .withArgs(frxETH.address, addresses.zero);

      expect(await oethVault.isSupportedAsset(frxETH.address)).to.be.false;
      expect(await oethVault.checkBalance(frxETH.address)).to.equal(0);
      expect(await oethVault.assetDefaultStrategies(frxETH.address)).to.equal(
        addresses.zero
      );

      const allAssets = await oethVault.getAllAssets();
      expect(allAssets.length).to.equal(assetCount - 1);

      expect(allAssets).to.not.contain(frxETH.address);

      const config = await oethVault.getAssetConfig(frxETH.address);
      expect(config.isSupported).to.be.false;
    });

    it("Should only allow governance to remove assets", async () => {
      const { oethVault, weth, strategist, josh } = fixture;

      for (const signer of [strategist, josh]) {
        let tx = oethVault.connect(signer).removeAsset(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");

        tx = oethVault.connect(signer).removeAsset(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Fail to remove asset if asset is not supported", async () => {
      const { oethVault, usds, governor } = fixture;
      const tx = oethVault.connect(governor).removeAsset(usds.address);

      await expect(tx).to.be.revertedWith("Asset not supported");
    });

    it("Fail to remove asset if vault still holds the asset", async () => {
      const { oethVault, weth, governor, daniel } = fixture;

      await oethVault.connect(daniel).mint(weth.address, oethUnits("1"), "0");

      const tx = oethVault.connect(governor).removeAsset(weth.address);

      await expect(tx).to.be.revertedWith("Vault still holds asset");
    });

    it("Fail to revert for smaller dust", async () => {
      const { oethVault, weth, governor, daniel } = fixture;

      await oethVault.connect(daniel).mint(weth.address, "500000000000", "0");

      const tx = oethVault.connect(governor).removeAsset(weth.address);

      await expect(tx).to.not.be.revertedWith("Vault still holds asset");
    });

    it("Should allow strategy to burnForStrategy", async () => {
      const { oethVault, oeth, weth, governor, daniel } = fixture;

      await oethVault.connect(governor).approveStrategy(daniel.address);
      await oethVault
        .connect(governor)
        .addStrategyToMintWhitelist(daniel.address);

      // First increase netOusdMintForStrategyThreshold
      await oethVault
        .connect(governor)
        .setNetOusdMintForStrategyThreshold(oethUnits("100"));

      // Then mint for strategy
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");

      await expect(await oeth.balanceOf(daniel.address)).to.equal(
        oethUnits("10")
      );

      // Then burn for strategy
      await oethVault.connect(daniel).burnForStrategy(oethUnits("10"));

      await expect(await oeth.balanceOf(daniel.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Fail when burnForStrategy because amount > int256 ", async () => {
      const { oethVault, governor, daniel } = fixture;

      await oethVault.connect(governor).approveStrategy(daniel.address);
      await oethVault
        .connect(governor)
        .addStrategyToMintWhitelist(daniel.address);

      const tx = oethVault
        .connect(daniel)
        .burnForStrategy(parseUnits("10", 76));

      await expect(tx).to.be.revertedWith(
        "SafeCast: value doesn't fit in an int256"
      );
    });

    it("Governor should remove strategy from mint whitelist", async () => {
      const { oethVault, governor, daniel } = fixture;

      await oethVault.connect(governor).approveStrategy(daniel.address);
      await oethVault
        .connect(governor)
        .addStrategyToMintWhitelist(daniel.address);

      expect(await oethVault.isMintWhitelistedStrategy(daniel.address)).to.be
        .true;

      const tx = await oethVault
        .connect(governor)
        .removeStrategyFromMintWhitelist(daniel.address);

      expect(tx)
        .to.emit(oethVault, "StrategyRemovedFromMintWhitelist")
        .withArgs(daniel.address);

      expect(await oethVault.isMintWhitelistedStrategy(daniel.address)).to.be
        .false;
    });
  });

  describe("Allocate", () => {
    const delayPeriod = 10 * 60; // 10mins
    it("Shouldn't allocate as minted amount is lower than autoAllocateThreshold", async () => {
      const { oethVault, weth, daniel } = fixture;

      // Set auto allocate threshold to 100 WETH
      await oethVault
        .connect(await impersonateAndFund(await oethVault.governor()))
        .setAutoAllocateThreshold(oethUnits("100"));

      // Mint for 10 WETH
      const tx = oethVault
        .connect(daniel)
        .mint(weth.address, oethUnits("10"), "0");

      await expect(tx).to.not.emit(oethVault, "AssetAllocated");
    });
    it("Shouldn't allocate as no WETH available", async () => {
      const { oethVault, weth, daniel } = fixture;

      // Deploy default strategy
      const mockStrategy = await deployWithConfirmation("MockStrategy");
      await oethVault
        .connect(await impersonateAndFund(await oethVault.governor()))
        .approveStrategy(mockStrategy.address);
      await oethVault
        .connect(await impersonateAndFund(await oethVault.governor()))
        .setAssetDefaultStrategy(weth.address, mockStrategy.address);

      // Mint will allocate all to default strategy bc no buffer, no threshold
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");
      await oethVault.connect(daniel).requestWithdrawal(oethUnits("5"));

      // Deposit less than queued amount (5 WETH) => _wethAvailable() return 0
      const tx = oethVault
        .connect(daniel)
        .mint(weth.address, oethUnits("3", "0"));
      expect(tx).to.not.emit(oethVault, "AssetAllocated");
    });
    it("Shouldn't allocate as WETH available is lower than buffer", async () => {
      const { oethVault, weth, daniel } = fixture;

      await oethVault.connect(daniel).mint(weth.address, oethUnits("100"), "0");

      // Set vault buffer to 5%
      await oethVault
        .connect(await impersonateAndFund(await oethVault.governor()))
        .setVaultBuffer(oethUnits("0.05"));

      // OETH total supply = 100(first deposit) + 5(second deposit) = 105
      // Buffer = 105 * 5% = 5.25 WETH
      // Second deposit should remain in the vault as below vault buffer
      const tx = oethVault.connect(daniel).mint(oethUnits("5"), "0");
      expect(tx).to.not.emit(oethVault, "AssetAllocated");
    });
    it("Shouldn't allocate as default strategy is address null", async () => {
      const { oethVault, weth, daniel } = fixture;

      const tx = oethVault
        .connect(daniel)
        .mint(weth.address, oethUnits("100"), "0");

      expect(tx).to.not.emit(oethVault, "AssetAllocated");
    });
    describe("Should allocate WETH available to default strategy when: ", () => {
      let mockStrategy;
      beforeEach(async () => {
        // Deploy default strategy
        const { oethVault, weth } = fixture;
        mockStrategy = await deployWithConfirmation("MockStrategy");
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .approveStrategy(mockStrategy.address);
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setAssetDefaultStrategy(weth.address, mockStrategy.address);
      });
      it("buffer is 0%, 0 WETH in queue", async () => {
        const { oethVault, daniel, weth } = fixture;
        const tx = oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await expect(tx)
          .to.emit(oethVault, "AssetAllocated")
          .withArgs(weth.address, mockStrategy.address, oethUnits("10"));
        expect(await weth.balanceOf(mockStrategy.address)).to.be.equal(
          oethUnits("10")
        );
      });
      it("buffer is 5%", async () => {
        const { oethVault, daniel, weth } = fixture;
        // Set vault buffer to 5%
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setVaultBuffer(oethUnits("0.05"));

        const tx = oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await expect(tx)
          .to.emit(oethVault, "AssetAllocated")
          .withArgs(weth.address, mockStrategy.address, oethUnits("9.5"));
        expect(await weth.balanceOf(mockStrategy.address)).to.be.equal(
          oethUnits("9.5")
        );
      });
      it("buffer is 0%, 10 WETH in queue", async () => {
        const { oethVault, daniel, weth } = fixture;
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("10"));
        const tx = oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("20"), "0");

        // 10 WETH in the queue, 10 WETH in strat. New deposit of 20, only 10 WETH available to allocate to strategy.
        await expect(tx)
          .to.emit(oethVault, "AssetAllocated")
          .withArgs(weth.address, mockStrategy.address, oethUnits("10"));
        expect(await weth.balanceOf(mockStrategy.address)).to.be.equal(
          oethUnits("20")
        );
      });
      it("buffer is 0%, 20 WETH in queue, 10 WETH claimed", async () => {
        const { oethVault, daniel, weth } = fixture;
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("30"), "0");
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("10"));
        await advanceTime(delayPeriod);
        // Simulate strategist pulling back WETH to the vault.
        await weth
          .connect(await impersonateAndFund(mockStrategy.address))
          .transfer(oethVault.address, oethUnits("10"));
        await oethVault.connect(daniel).claimWithdrawal(0);
        // So far, 10 WETH queued, 10 WETH claimed, 0 WETH available, 20 WETH in strat

        await oethVault.connect(daniel).requestWithdrawal(oethUnits("10"));
        // So far, 20 WETH queued, 10 WETH claimed, 0 WETH available, 20 WETH in strat

        // Deposit 35 WETH, 10 WETH should remain in the vault for withdraw, so strat should have 45WETH.
        const tx = oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("35"), "0");
        await expect(tx)
          .to.emit(oethVault, "AssetAllocated")
          .withArgs(weth.address, mockStrategy.address, oethUnits("25"));

        expect(await weth.balanceOf(mockStrategy.address)).to.be.equal(
          oethUnits("45")
        );
      });
      it("buffer is 5%, 20 WETH in queue, 10 WETH claimed", async () => {
        const { oethVault, daniel, weth } = fixture;
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("40"), "0");
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("10"));
        await advanceTime(delayPeriod);
        // Simulate strategist pulling back WETH to the vault.
        await weth
          .connect(await impersonateAndFund(mockStrategy.address))
          .transfer(oethVault.address, oethUnits("10"));
        await oethVault.connect(daniel).claimWithdrawal(0);
        // So far, 10 WETH queued, 10 WETH claimed, 0 WETH available, 30 WETH in strat

        await oethVault.connect(daniel).requestWithdrawal(oethUnits("10"));
        // So far, 20 WETH queued, 10 WETH claimed, 0 WETH available, 30 WETH in strat

        // Set vault buffer to 5%
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setVaultBuffer(oethUnits("0.05"));

        // Deposit 40 WETH, 10 WETH should remain in the vault for withdraw + 3 (i.e. 20+40 *5%)
        // So strat should have 57WETH.
        const tx = oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("40"), "0");
        await expect(tx)
          .to.emit(oethVault, "AssetAllocated")
          .withArgs(weth.address, mockStrategy.address, oethUnits("27"));

        expect(await weth.balanceOf(mockStrategy.address)).to.be.equal(
          oethUnits("57")
        );
      });
    });
  });

  describe("Withdrawal Queue", () => {
    const delayPeriod = 10 * 60; // 10 minutes
    describe("with all 60 WETH in the vault", () => {
      beforeEach(async () => {
        const { oethVault, weth, daniel, josh, matt } = fixture;
        // Mint some OETH to three users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("30"), "0");
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setMaxSupplyDiff(oethUnits("0.03"));
      });
      const firstRequestAmount = oethUnits("5");
      const secondRequestAmount = oethUnits("18");
      it("Should request first withdrawal by Daniel", async () => {
        const { oethVault, daniel } = fixture;
        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault
          .connect(daniel)
          .requestWithdrawal(firstRequestAmount);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalRequested")
          .withArgs(daniel.address, 0, firstRequestAmount, firstRequestAmount);

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: firstRequestAmount.mul(-1),
            oethTotalValue: firstRequestAmount.mul(-1),
            vaultCheckBalance: firstRequestAmount.mul(-1),
            userOeth: firstRequestAmount.mul(-1),
            userWeth: 0,
            vaultWeth: 0,
            queued: firstRequestAmount,
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should request withdrawal of zero amount", async () => {
        const { oethVault, josh } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };
        await oethVault.connect(josh).requestWithdrawal(firstRequestAmount);
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault.connect(josh).requestWithdrawal(0);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalRequested")
          .withArgs(josh.address, 1, 0, firstRequestAmount);

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: 0,
            vaultWeth: 0,
            queued: 0,
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should request first and second withdrawals with no WETH in the Vault", async () => {
        const { oethVault, governor, josh, matt, weth } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };

        const mockStrategy = await deployWithConfirmation("MockStrategy");
        await oethVault.connect(governor).approveStrategy(mockStrategy.address);

        // Deposit all 10 + 20 + 30 = 60 WETH to strategy
        await oethVault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [weth.address],
            [oethUnits("60")]
          );

        const dataBefore = await snapData(fixtureWithUser);

        await oethVault.connect(josh).requestWithdrawal(firstRequestAmount);
        const tx = await oethVault
          .connect(matt)
          .requestWithdrawal(secondRequestAmount);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalRequested")
          .withArgs(
            matt.address,
            1,
            secondRequestAmount,
            firstRequestAmount.add(secondRequestAmount)
          );

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: firstRequestAmount
              .add(secondRequestAmount)
              .mul(-1),
            oethTotalValue: firstRequestAmount.add(secondRequestAmount).mul(-1),
            vaultCheckBalance: firstRequestAmount
              .add(secondRequestAmount)
              .mul(-1),
            userOeth: firstRequestAmount.mul(-1),
            userWeth: 0,
            vaultWeth: 0,
            queued: firstRequestAmount.add(secondRequestAmount),
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 2,
          },
          fixtureWithUser
        );
      });
      it("Should request second withdrawal by matt", async () => {
        const { oethVault, daniel, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault
          .connect(matt)
          .requestWithdrawal(secondRequestAmount);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalRequested")
          .withArgs(
            matt.address,
            1,
            secondRequestAmount,
            firstRequestAmount.add(secondRequestAmount)
          );

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: secondRequestAmount.mul(-1),
            oethTotalValue: secondRequestAmount.mul(-1),
            vaultCheckBalance: secondRequestAmount.mul(-1),
            userOeth: secondRequestAmount.mul(-1),
            userWeth: 0,
            vaultWeth: 0,
            queued: secondRequestAmount,
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should add claimable liquidity to the withdrawal queue", async () => {
        const { oethVault, daniel, josh } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };
        await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
        await oethVault.connect(josh).requestWithdrawal(secondRequestAmount);
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault.connect(josh).addWithdrawalQueueLiquidity();

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimable")
          .withArgs(
            firstRequestAmount.add(secondRequestAmount),
            firstRequestAmount.add(secondRequestAmount)
          );

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: 0,
            vaultWeth: 0,
            queued: 0,
            claimable: firstRequestAmount.add(secondRequestAmount),
            claimed: 0,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should claim second request with enough liquidity", async () => {
        const { oethVault, daniel, josh } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };
        await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
        await oethVault.connect(josh).requestWithdrawal(secondRequestAmount);
        const requestId = 1; // ids start at 0 so the second request is at index 1
        const dataBefore = await snapData(fixtureWithUser);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await oethVault.connect(josh).claimWithdrawal(requestId);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(josh.address, requestId, secondRequestAmount);
        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimable")
          .withArgs(
            firstRequestAmount.add(secondRequestAmount),
            firstRequestAmount.add(secondRequestAmount)
          );

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: secondRequestAmount,
            vaultWeth: secondRequestAmount.mul(-1),
            queued: 0,
            claimable: firstRequestAmount.add(secondRequestAmount),
            claimed: secondRequestAmount,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should claim multiple requests with enough liquidity", async () => {
        const { oethVault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        await oethVault.connect(matt).requestWithdrawal(firstRequestAmount);
        await oethVault.connect(matt).requestWithdrawal(secondRequestAmount);
        const dataBefore = await snapData(fixtureWithUser);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await oethVault.connect(matt).claimWithdrawals([0, 1]);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(matt.address, 0, firstRequestAmount);
        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(matt.address, 1, secondRequestAmount);
        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimable")
          .withArgs(
            firstRequestAmount.add(secondRequestAmount),
            firstRequestAmount.add(secondRequestAmount)
          );

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: firstRequestAmount.add(secondRequestAmount),
            vaultWeth: firstRequestAmount.add(secondRequestAmount).mul(-1),
            queued: 0,
            claimable: firstRequestAmount.add(secondRequestAmount),
            claimed: firstRequestAmount.add(secondRequestAmount),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should claim single big request as a whale", async () => {
        const { oethVault, oeth, matt } = fixture;

        const oethBalanceBefore = await oeth.balanceOf(matt.address);
        const totalValueBefore = await oethVault.totalValue();

        await oethVault.connect(matt).requestWithdrawal(oethUnits("30"));

        const oethBalanceAfter = await oeth.balanceOf(matt.address);
        const totalValueAfter = await oethVault.totalValue();
        await expect(oethBalanceBefore).to.equal(oethUnits("30"));
        await expect(oethBalanceAfter).to.equal(oethUnits("0"));
        await expect(totalValueBefore.sub(totalValueAfter)).to.equal(
          oethUnits("30")
        );

        const oethTotalSupply = await oeth.totalSupply();
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        const tx = await oethVault.connect(matt).claimWithdrawal(0); // Claim withdrawal for 50% of the supply

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(matt.address, 0, oethUnits("30"));

        await expect(oethTotalSupply).to.equal(await oeth.totalSupply());
        await expect(totalValueAfter).to.equal(await oethVault.totalValue());
      });

      it("Fail to claim request because of not enough time passed", async () => {
        const { oethVault, daniel } = fixture;

        // Daniel requests 5 OETH to be withdrawn
        await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
        const requestId = 0;

        // Daniel claimWithdraw request in the same block as the request
        const tx = oethVault.connect(daniel).claimWithdrawal(requestId);

        await expect(tx).to.revertedWith("Claim delay not met");
      });
      it("Fail to request withdrawal because of solvency check too high", async () => {
        const { oethVault, daniel, weth } = fixture;

        await weth.connect(daniel).transfer(oethVault.address, oethUnits("10"));

        const tx = oethVault
          .connect(daniel)
          .requestWithdrawal(firstRequestAmount);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });
      it("Fail to claim request because of solvency check too high", async () => {
        const { oethVault, daniel, weth } = fixture;

        // Request withdrawal of 5 OETH
        await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);

        // Transfer 10 WETH to the vault
        await weth.connect(daniel).transfer(oethVault.address, oethUnits("10"));

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Claim the withdrawal
        const tx = oethVault.connect(daniel).claimWithdrawal(0);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });
      it("Fail multiple claim requests because of solvency check too high", async () => {
        const { oethVault, matt, weth } = fixture;

        // Request withdrawal of 5 OETH
        await oethVault.connect(matt).requestWithdrawal(firstRequestAmount);
        await oethVault.connect(matt).requestWithdrawal(secondRequestAmount);

        // Transfer 10 WETH to the vault
        await weth.connect(matt).transfer(oethVault.address, oethUnits("10"));

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Claim the withdrawal
        const tx = oethVault.connect(matt).claimWithdrawals([0, 1]);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });

      it("Fail request withdrawal because of solvency check too low", async () => {
        const { oethVault, daniel, weth } = fixture;

        // Simulate a loss of funds from the vault
        await weth
          .connect(await impersonateAndFund(oethVault.address))
          .transfer(daniel.address, oethUnits("10"));

        const tx = oethVault
          .connect(daniel)
          .requestWithdrawal(firstRequestAmount);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });

      describe("when deposit 15 WETH to a strategy, leaving 60 - 15 = 45 WETH in the vault; request withdrawal of 5 + 18 = 23 OETH, leaving 45 - 23 = 22 WETH unallocated", () => {
        let mockStrategy;
        beforeEach(async () => {
          const { oethVault, weth, governor, daniel, josh } = fixture;

          const dMockStrategy = await deployWithConfirmation("MockStrategy");
          mockStrategy = await ethers.getContractAt(
            "MockStrategy",
            dMockStrategy.address
          );
          await mockStrategy.setWithdrawAll(weth.address, oethVault.address);
          await oethVault
            .connect(governor)
            .approveStrategy(mockStrategy.address);

          // Deposit 15 WETH of 10 + 20 + 30 = 60 WETH to strategy
          // This leave 60 - 15 = 45 WETH in the vault
          await oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("15")]
            );
          // Request withdrawal of 5 + 18 = 23 OETH
          // This leave 45 - 23 = 22 WETH unallocated to the withdrawal queue
          await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
          await oethVault.connect(josh).requestWithdrawal(secondRequestAmount);
        });
        it("Fail to deposit allocated WETH to a strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          // 23 WETH to deposit > the 22 WETH available so it should revert
          const depositAmount = oethUnits("23");
          const tx = oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [depositAmount]
            );
          await expect(tx).to.be.revertedWith("Not enough WETH available");
        });
        it("Fail to deposit allocated WETH during allocate", async () => {
          const { oethVault, governor, weth } = fixture;

          // Set mock strategy as default strategy
          await oethVault
            .connect(governor)
            .setAssetDefaultStrategy(weth.address, mockStrategy.address);

          // and buffer to 10%
          await oethVault.connect(governor).setVaultBuffer(oethUnits("0.1"));

          // WETH in strategy = 15  WETH
          // WETH in the vault = 60 - 15 = 45 WETH
          // Unallocated WETH in the vault = 45 - 23 = 22 WETH

          await oethVault.connect(governor).allocate();

          expect(await weth.balanceOf(mockStrategy.address)).to.approxEqual(
            // 60 - 23 = 37 Unreserved WETH
            // 90% of 37 = 33.3 WETH for allocation
            oethUnits("33.3"),
            "Strategy has the reserved WETH"
          );

          expect(await weth.balanceOf(oethVault.address)).to.approxEqual(
            // 10% of 37 = 3.7 WETH for Vault buffer
            // + 23 reserved WETH
            oethUnits("23").add(oethUnits("3.7")),
            "Vault doesn't have enough WETH"
          );
        });
        it("Should deposit unallocated WETH to a strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          const depositAmount = oethUnits("22");
          await oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [depositAmount]
            );
        });
        it("Should claim first request with enough liquidity", async () => {
          const { oethVault, daniel } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = await oethVault.connect(daniel).claimWithdrawal(0);

          await expect(tx)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(daniel.address, 0, firstRequestAmount);

          await assertChangedData(
            dataBefore,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: firstRequestAmount,
              vaultWeth: firstRequestAmount.mul(-1),
              queued: 0,
              claimable: firstRequestAmount.add(secondRequestAmount),
              claimed: firstRequestAmount,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Should claim a new request with enough WETH liquidity", async () => {
          const { oethVault, matt } = fixture;
          const fixtureWithUser = { ...fixture, user: matt };

          // Set the claimable amount to the queued amount
          await oethVault.addWithdrawalQueueLiquidity();

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          // Matt request all unallocated WETH to be withdrawn
          const requestAmount = oethUnits("22");
          await oethVault.connect(matt).requestWithdrawal(requestAmount);

          const dataBefore = await snapData(fixtureWithUser);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = await oethVault.connect(matt).claimWithdrawal(2);

          await expect(tx)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(matt.address, 2, requestAmount);

          await assertChangedData(
            dataBefore,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: requestAmount,
              vaultWeth: requestAmount.mul(-1),
              queued: 0,
              claimable: requestAmount,
              claimed: requestAmount,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Fail to claim a new request with NOT enough WETH liquidity", async () => {
          const { oethVault, matt } = fixture;

          // Matt request 23 OETH to be withdrawn when only 22 WETH is unallocated to existing requests
          const requestAmount = oethUnits("23");
          await oethVault.connect(matt).requestWithdrawal(requestAmount);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = oethVault.connect(matt).claimWithdrawal(2);
          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Should claim a new request after withdraw from strategy adds enough liquidity", async () => {
          const { oethVault, daniel, matt, strategist, weth } = fixture;

          // Set the claimable amount to the queued amount
          await oethVault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
          const requestAmount = oethUnits("30");
          await oethVault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
          const withdrawAmount = oethUnits("8");
          await oethVault
            .connect(strategist)
            .withdrawFromStrategy(
              mockStrategy.address,
              [weth.address],
              [withdrawAmount]
            );

          await assertChangedData(
            dataBeforeMint,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: 0,
              vaultWeth: withdrawAmount,
              queued: 0,
              claimable: requestAmount,
              claimed: 0,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          await oethVault.connect(matt).claimWithdrawal(2);
        });
        it("Should claim a new request after withdrawAllFromStrategy adds enough liquidity", async () => {
          const { oethVault, daniel, matt, strategist, weth } = fixture;

          // Set the claimable amount to the queued amount
          await oethVault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
          const requestAmount = oethUnits("30");
          await oethVault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);
          const strategyBalanceBefore = await weth.balanceOf(
            mockStrategy.address
          );

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
          await oethVault
            .connect(strategist)
            .withdrawAllFromStrategy(mockStrategy.address);

          await assertChangedData(
            dataBeforeMint,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: 0,
              vaultWeth: strategyBalanceBefore,
              queued: 0,
              claimable: requestAmount,
              claimed: 0,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          await oethVault.connect(matt).claimWithdrawal(2);
        });
        it("Should claim a new request after withdrawAll from strategies adds enough liquidity", async () => {
          const { oethVault, daniel, matt, strategist, weth } = fixture;

          // Set the claimable amount to the queued amount
          await oethVault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
          const requestAmount = oethUnits("30");
          await oethVault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);
          const strategyBalanceBefore = await weth.balanceOf(
            mockStrategy.address
          );

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
          await oethVault.connect(strategist).withdrawAllFromStrategies();

          await assertChangedData(
            dataBeforeMint,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: 0,
              vaultWeth: strategyBalanceBefore,
              queued: 0,
              claimable: requestAmount,
              claimed: 0,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          await oethVault.connect(matt).claimWithdrawal(2);
        });
        it("Fail to claim a new request after mint with NOT enough liquidity", async () => {
          const { oethVault, daniel, matt, weth } = fixture;

          // Matt requests all 30 OETH to be withdrawn which is not enough liquidity
          const requestAmount = oethUnits("30");
          await oethVault.connect(matt).requestWithdrawal(requestAmount);

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          // Add another 6 WETH so the unallocated WETH is 22 + 6 = 28 WETH
          await oethVault.connect(daniel).mint(weth.address, oethUnits("6"), 0);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = oethVault.connect(matt).claimWithdrawal(2);
          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Should claim a new request after mint adds enough liquidity", async () => {
          const { oethVault, daniel, matt, weth } = fixture;

          // Set the claimable amount to the queued amount
          await oethVault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
          const requestAmount = oethUnits("30");
          await oethVault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);

          // WETH in the vault = 60 - 15 = 45 WETH
          // unallocated WETH in the Vault = 45 - 23 = 22 WETH
          // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
          const mintAmount = oethUnits("8");
          await oethVault.connect(daniel).mint(weth.address, mintAmount, 0);

          await assertChangedData(
            dataBeforeMint,
            {
              oethTotalSupply: mintAmount,
              oethTotalValue: mintAmount,
              vaultCheckBalance: mintAmount,
              userOeth: mintAmount,
              userWeth: mintAmount.mul(-1),
              vaultWeth: mintAmount,
              queued: 0,
              claimable: requestAmount,
              claimed: 0,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          await oethVault.connect(matt).claimWithdrawal(2);
        });
      });

      describe("Fail when", () => {
        it("request doesn't have enough OETH", async () => {
          const { oethVault, josh } = fixture;
          const fixtureWithUser = { ...fixture, user: josh };
          const dataBefore = await snapData(fixtureWithUser);

          const tx = oethVault
            .connect(josh)
            .requestWithdrawal(dataBefore.userOeth.add(1));

          await expect(tx).to.revertedWith("Transfer amount exceeds balance");
        });
        it("capital is paused", async () => {
          const { oethVault, governor, josh } = fixture;

          await oethVault.connect(governor).pauseCapital();

          const tx = oethVault
            .connect(josh)
            .requestWithdrawal(firstRequestAmount);

          await expect(tx).to.be.revertedWith("Capital paused");
        });
      });
    });
    describe("with 1% vault buffer, 30 WETH in the queue, 15 WETH in the vault, 85 WETH in the strategy, 5 WETH already claimed", () => {
      let mockStrategy;
      beforeEach(async () => {
        const { governor, oethVault, weth, daniel, domen, josh, matt } =
          fixture;
        // Mint 105 OETH to four users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("15"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("30"), "0");
        await oethVault.connect(domen).mint(weth.address, oethUnits("40"), "0");
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setMaxSupplyDiff(oethUnits("0.03"));

        // Request and claim 2 + 3 = 5 WETH from Vault
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("2"));
        await oethVault.connect(josh).requestWithdrawal(oethUnits("3"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        await oethVault.connect(daniel).claimWithdrawal(0);
        await oethVault.connect(josh).claimWithdrawal(1);

        // Deploy a mock strategy
        mockStrategy = await deployWithConfirmation("MockStrategy");
        await oethVault.connect(governor).approveStrategy(mockStrategy.address);

        // Deposit 85 WETH to strategy
        await oethVault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [weth.address],
            [oethUnits("85")]
          );

        // Set vault buffer to 1%
        await oethVault.connect(governor).setVaultBuffer(oethUnits("0.01"));

        // Have 4 + 12 + 16 = 32 WETH outstanding requests
        // So a total supply of 100 - 32 = 68 OETH
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("4"));
        await oethVault.connect(josh).requestWithdrawal(oethUnits("12"));
        await oethVault.connect(matt).requestWithdrawal(oethUnits("16"));

        await oethVault.connect(josh).addWithdrawalQueueLiquidity();
      });
      describe("Fail to claim", () => {
        it("a previously claimed withdrawal", async () => {
          const { oethVault, daniel } = fixture;

          const tx = oethVault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Already claimed");
        });
        it("the first withdrawal with wrong withdrawer", async () => {
          const { oethVault, matt } = fixture;

          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);

          const tx = oethVault.connect(matt).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Not requester");
        });
        it("the first withdrawal request in the queue before 30 minutes", async () => {
          const { oethVault, daniel } = fixture;

          const tx = oethVault.connect(daniel).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Claim delay not met");
        });
      });
      describe("when waited 30 minutes", () => {
        beforeEach(async () => {
          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);
        });
        it("Fail to claim the first withdrawal with wrong withdrawer", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Not requester");
        });
        it("Should claim the first withdrawal request in the queue after 30 minutes", async () => {
          const { oethVault, daniel } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const tx = await oethVault.connect(daniel).claimWithdrawal(2);

          await expect(tx)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(daniel.address, 2, oethUnits("4"));

          await assertChangedData(
            dataBefore,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: oethUnits("4"),
              vaultWeth: oethUnits("4").mul(-1),
              queued: 0,
              claimable: 0,
              claimed: oethUnits("4"),
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Fail to claim the second withdrawal request in the queue after 30 minutes", async () => {
          const { oethVault, josh } = fixture;

          const tx = oethVault.connect(josh).claimWithdrawal(3);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Fail to claim the last (3rd) withdrawal request in the queue", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).claimWithdrawal(4);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
      });
      describe("when mint covers exactly outstanding requests (32 - 15 = 17 OETH)", () => {
        beforeEach(async () => {
          const { oethVault, daniel, weth } = fixture;
          await oethVault
            .connect(daniel)
            .mint(weth.address, oethUnits("17"), "0");

          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);
        });
        it("Should claim the 2nd and 3rd withdrawal requests in the queue", async () => {
          const { oethVault, daniel, josh } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const tx1 = await oethVault.connect(daniel).claimWithdrawal(2);

          await expect(tx1)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(daniel.address, 2, oethUnits("4"));

          const tx2 = await oethVault.connect(josh).claimWithdrawal(3);

          await expect(tx2)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(josh.address, 3, oethUnits("12"));

          await assertChangedData(
            dataBefore,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: oethUnits("4"),
              vaultWeth: oethUnits("16").mul(-1),
              queued: 0,
              claimable: 0,
              claimed: oethUnits("16"),
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Fail to deposit 1 WETH to a strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("1")]
            );

          await expect(tx).to.be.revertedWith("Not enough WETH available");
        });
        it("Fail to allocate any WETH to the default strategy", async () => {
          const { oethVault, domen } = fixture;

          const tx = await oethVault.connect(domen).allocate();

          await expect(tx).to.not.emit(oethVault, "AssetAllocated");
        });
      });
      describe("when mint covers exactly outstanding requests and vault buffer (17 + 1 WETH)", () => {
        beforeEach(async () => {
          const { oethVault, daniel, weth } = fixture;
          await oethVault
            .connect(daniel)
            .mint(weth.address, oethUnits("18"), "0");
        });
        it("Should deposit 1 WETH to a strategy which is the vault buffer", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = await oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("1")]
            );

          expect(tx)
            .to.emit(weth, "Transfer")
            .withArgs(oethVault.address, mockStrategy.address, oethUnits("1"));
        });
        it("Fail to deposit 1.1 WETH to the default strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("1.1")]
            );

          await expect(tx).to.be.revertedWith("Not enough WETH available");
        });
        it("Fail to allocate any WETH to the default strategy", async () => {
          const { oethVault, domen } = fixture;

          const tx = await oethVault.connect(domen).allocate();

          await expect(tx).to.not.emit(oethVault, "AssetAllocated");
        });
      });
      describe("when mint more than covers outstanding requests and vault buffer (17 + 1 + 3 = 21 OETH)", () => {
        beforeEach(async () => {
          const { oethVault, daniel, weth } = fixture;
          await oethVault
            .connect(daniel)
            .mint(weth.address, oethUnits("21"), "0");
        });
        it("Should deposit 4 WETH to a strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = await oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("4")]
            );

          expect(tx)
            .to.emit(weth, "Transfer")
            .withArgs(oethVault.address, mockStrategy.address, oethUnits("4"));
        });
        it("Fail to deposit 5 WETH to the default strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("5")]
            );

          await expect(tx).to.be.revertedWith("Not enough WETH available");
        });
        it("Should allocate 3 WETH to the default strategy", async () => {
          const { oethVault, governor, domen, weth } = fixture;

          await oethVault
            .connect(governor)
            .setAssetDefaultStrategy(weth.address, mockStrategy.address);

          const vaultBalance = await weth.balanceOf(oethVault.address);
          const stratBalance = await weth.balanceOf(mockStrategy.address);

          const tx = await oethVault.connect(domen).allocate();

          // total supply is 68 starting + 21 minted = 89 OETH
          // Vault buffer is 1% of 89 = 0.89 WETH
          // WETH transfer amount = 4 WETH available in vault - 0.89 WETH buffer = 3.11 WETH
          await expect(tx)
            .to.emit(oethVault, "AssetAllocated")
            .withArgs(weth.address, mockStrategy.address, oethUnits("3.11"));

          expect(await weth.balanceOf(oethVault.address)).to.eq(
            vaultBalance.sub(oethUnits("3.11"))
          );

          expect(await weth.balanceOf(mockStrategy.address)).to.eq(
            stratBalance.add(oethUnits("3.11"))
          );
        });
      });
    });
    describe("with 40 WETH in the queue, 10 WETH in the vault, 30 WETH already claimed", () => {
      beforeEach(async () => {
        const { oethVault, weth, daniel, josh, matt } = fixture;

        // Mint 60 OETH to three users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("10"), "0");

        // Request and claim 10 WETH from Vault
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("10"));
        await oethVault.connect(josh).requestWithdrawal(oethUnits("20"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Claim 10 + 20 = 30 WETH from Vault
        await oethVault.connect(daniel).claimWithdrawal(0);
        await oethVault.connect(josh).claimWithdrawal(1);
      });
      it("Should allow the last user to request the remaining 10 WETH", async () => {
        const { oethVault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault
          .connect(matt)
          .requestWithdrawal(oethUnits("10"));

        await expect(tx)
          .to.emit(oethVault, "WithdrawalRequested")
          .withArgs(matt.address, 2, oethUnits("10"), oethUnits("40"));

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: oethUnits("10").mul(-1),
            oethTotalValue: oethUnits("10").mul(-1),
            vaultCheckBalance: oethUnits("10").mul(-1),
            userOeth: oethUnits("10").mul(-1),
            userWeth: 0,
            vaultWeth: 0,
            queued: oethUnits("10").mul(1),
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should allow the last user to claim the request of 10 WETH", async () => {
        const { oethVault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        await oethVault.connect(matt).requestWithdrawal(oethUnits("10"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault.connect(matt).claimWithdrawal(2);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(matt.address, 2, oethUnits("10"));

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: oethUnits("10"),
            vaultWeth: oethUnits("10").mul(-1),
            queued: 0,
            claimable: oethUnits("10"),
            claimed: oethUnits("10"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );

        expect(await oethVault.totalValue()).to.equal(0);
      });
    });
    describe("with 40 WETH in the queue, 100 WETH in the vault, 0 WETH in the strategy", () => {
      beforeEach(async () => {
        const { oethVault, weth, daniel, josh, matt } = fixture;
        // Mint 100 OETH to three users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("70"), "0");

        // Request 40 WETH from Vault
        await oethVault.connect(matt).requestWithdrawal(oethUnits("40"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
      });
      it("Should allow user to claim the request of 40 WETH", async () => {
        const { oethVault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault.connect(matt).claimWithdrawal(0);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(matt.address, 0, oethUnits("40"));

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: oethUnits("40"),
            vaultWeth: oethUnits("40").mul(-1),
            queued: 0,
            claimable: oethUnits("40"),
            claimed: oethUnits("40"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should allow user to perform a new request and claim a smaller than the WETH available", async () => {
        const { oethVault, josh } = fixture;

        await oethVault.connect(josh).requestWithdrawal(oethUnits("20"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await oethVault.connect(josh).claimWithdrawal(1);

        await expect(tx).to.emit(oethVault, "WithdrawalClaimed");
      });
      it("Should allow user to perform a new request and claim exactly the WETH available", async () => {
        const { oethVault, oeth, josh, matt, daniel } = fixture;
        await oethVault.connect(matt).claimWithdrawal(0);
        // All user give OETH to another user
        await oeth.connect(josh).transfer(matt.address, oethUnits("20"));
        await oeth.connect(daniel).transfer(matt.address, oethUnits("10"));

        const fixtureWithUser = { ...fixture, user: matt };

        // Matt request the remaining 60 OETH to be withdrawn
        await oethVault.connect(matt).requestWithdrawal(oethUnits("60"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault.connect(matt).claimWithdrawal(1);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(matt.address, 1, oethUnits("60"));

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: oethUnits("60"),
            vaultWeth: oethUnits("60").mul(-1),
            queued: 0,
            claimable: oethUnits("60"),
            claimed: oethUnits("60"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Shouldn't allow user to perform a new request and claim more than the WETH available", async () => {
        const { oethVault, oeth, weth, josh, matt, daniel } = fixture;
        await oethVault.connect(matt).claimWithdrawal(0);
        // All user give OETH to another user
        await oeth.connect(josh).transfer(matt.address, oethUnits("20"));
        await oeth.connect(daniel).transfer(matt.address, oethUnits("10"));

        // Matt request more than the remaining 60 OETH to be withdrawn
        await oethVault.connect(matt).requestWithdrawal(oethUnits("60"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        await weth
          .connect(await impersonateAndFund(oethVault.address))
          .transfer(addresses.dead, oethUnits("50")); // Vault loses 50 WETH

        const tx = oethVault.connect(matt).claimWithdrawal(1);
        await expect(tx).to.be.revertedWith("Queue pending liquidity");
      });
    });
    describe("with 40 WETH in the queue, 15 WETH in the vault, 44 WETH in the strategy, vault insolvent by 5% => Slash 1 ether (1/20 = 5%), 19 WETH total value", () => {
      beforeEach(async () => {
        const { governor, oethVault, weth, daniel, josh, matt, strategist } =
          fixture;
        // Deploy a mock strategy
        const mockStrategy = await deployWithConfirmation("MockStrategy");
        await oethVault.connect(governor).approveStrategy(mockStrategy.address);
        await oethVault
          .connect(governor)
          .setAssetDefaultStrategy(weth.address, mockStrategy.address);

        // Mint 60 OETH to three users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("30"), "0");

        // Request and claim 10 + 20 + 10 = 40 WETH from Vault
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("10"));
        await oethVault.connect(josh).requestWithdrawal(oethUnits("20"));
        await oethVault.connect(matt).requestWithdrawal(oethUnits("10"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Simulate slash event of 1 ethers
        await weth
          .connect(await impersonateAndFund(mockStrategy.address))
          .transfer(addresses.dead, oethUnits("1"));

        // Strategist sends 15 WETH to the vault
        await oethVault
          .connect(strategist)
          .withdrawFromStrategy(
            mockStrategy.address,
            [weth.address],
            [oethUnits("15")]
          );

        await oethVault.connect(josh).addWithdrawalQueueLiquidity();
      });
      it("Should allow first user to claim the request of 10 WETH", async () => {
        const { oethVault, daniel } = fixture;
        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await oethVault.connect(daniel).claimWithdrawal(0);

        expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(daniel.address, 0, oethUnits("10"));

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
            userOeth: 0,
            userWeth: oethUnits("10"),
            vaultWeth: oethUnits("10").mul(-1),
            queued: 0,
            claimable: 0,
            claimed: oethUnits("10"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Fail to allow second user to claim the request of 20 WETH, due to liquidity", async () => {
        const { oethVault, josh } = fixture;

        const tx = oethVault.connect(josh).claimWithdrawal(1);

        await expect(tx).to.be.revertedWith("Queue pending liquidity");
      });
      it("Should allow a user to create a new request with solvency check off", async () => {
        // maxSupplyDiff is set to 0 so no insolvency check
        const { oethVault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = oethVault.connect(matt).requestWithdrawal(oethUnits("10"));

        expect(tx)
          .to.emit(oethVault, "WithdrawalRequested")
          .withArgs(matt.address, 3, oethUnits("10"), oethUnits("50"));

        await assertChangedData(
          dataBefore,
          {
            oethTotalSupply: oethUnits("10").mul(-1),
            oethTotalValue: oethUnits("10").mul(-1),
            vaultCheckBalance: oethUnits("10").mul(-1),
            userOeth: oethUnits("10").mul(-1),
            userWeth: 0,
            vaultWeth: 0,
            queued: oethUnits("10").mul(1),
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      describe("with solvency check at 3%", () => {
        beforeEach(async () => {
          const { oethVault } = fixture;
          // Turn on insolvency check with 3% buffer
          await oethVault
            .connect(await impersonateAndFund(await oethVault.governor()))
            .setMaxSupplyDiff(oethUnits("0.03"));
        });
        it("Fail to allow user to create a new request due to insolvency check", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).requestWithdrawal(oethUnits("1"));

          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
        it("Fail to allow first user to claim a withdrawal due to insolvency check", async () => {
          const { oethVault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = oethVault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
      });
      describe("with solvency check at 10%", () => {
        beforeEach(async () => {
          const { oethVault } = fixture;
          // Turn on insolvency check with 10% buffer
          await oethVault
            .connect(await impersonateAndFund(await oethVault.governor()))
            .setMaxSupplyDiff(oethUnits("0.1"));
        });
        it("Should allow user to create a new request", async () => {
          const { oethVault, matt } = fixture;

          const tx = await oethVault
            .connect(matt)
            .requestWithdrawal(oethUnits("1"));

          expect(tx)
            .to.emit(oethVault, "WithdrawalRequested")
            .withArgs(matt.address, 3, oethUnits("1"), oethUnits("41"));
        });
        it("Should allow first user to claim the request of 10 WETH", async () => {
          const { oethVault, daniel } = fixture;

          const tx = await oethVault.connect(daniel).claimWithdrawal(0);

          expect(tx)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(daniel.address, 0, oethUnits("10"));
        });
      });
    });
    describe("with 99 WETH in the queue, 40 WETH in the vault, total supply 1, 1% insolvency buffer", () => {
      let mockStrategy;
      beforeEach(async () => {
        const { governor, oethVault, weth, daniel, josh, matt, strategist } =
          fixture;
        // Deploy a mock strategy
        mockStrategy = await deployWithConfirmation("MockStrategy");
        await oethVault.connect(governor).approveStrategy(mockStrategy.address);
        await oethVault
          .connect(governor)
          .setAssetDefaultStrategy(weth.address, mockStrategy.address);

        // Mint 100 OETH to three users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("30"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("50"), "0");

        // Request and claim 20 + 30 + 49 = 99 WETH from Vault
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("20"));
        await oethVault.connect(josh).requestWithdrawal(oethUnits("30"));
        await oethVault.connect(matt).requestWithdrawal(oethUnits("49"));

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Strategist sends 40 WETH to the vault
        await oethVault
          .connect(strategist)
          .withdrawFromStrategy(
            mockStrategy.address,
            [weth.address],
            [oethUnits("40")]
          );

        await oethVault.connect(josh).addWithdrawalQueueLiquidity();

        // Turn on insolvency check with 10% buffer
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setMaxSupplyDiff(oethUnits("0.01"));
      });
      describe("with 2 ether slashed leaving 100 - 40 - 2 = 58 WETH in the strategy", () => {
        beforeEach(async () => {
          const { weth } = fixture;

          // Simulate slash event of 2 ethers
          await weth
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(addresses.dead, oethUnits("2"));
        });
        it("Should have total value of zero", async () => {
          // 100 from mints - 99 outstanding withdrawals - 2 from slashing = -1 value which is rounder up to zero
          expect(await fixture.oethVault.totalValue()).to.equal(0);
        });
        it("Should have check balance of zero", async () => {
          const { oethVault, weth } = fixture;
          // 100 from mints - 99 outstanding withdrawals - 2 from slashing = -1 value which is rounder up to zero
          expect(await oethVault.checkBalance(weth.address)).to.equal(0);
        });
        it("Fail to allow user to create a new request due to too many outstanding requests", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).requestWithdrawal(oethUnits("1"));

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
        it("Fail to allow first user to claim a withdrawal due to too many outstanding requests", async () => {
          const { oethVault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = oethVault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
      });
      describe("with 1 ether slashed leaving 100 - 40 - 1 = 59 WETH in the strategy", () => {
        beforeEach(async () => {
          const { weth } = fixture;

          // Simulate slash event of 1 ethers
          await weth
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(addresses.dead, oethUnits("1"));
        });
        it("Should have total value of zero", async () => {
          // 100 from mints - 99 outstanding withdrawals - 1 from slashing = 0 value
          expect(await fixture.oethVault.totalValue()).to.equal(0);
        });
        it("Fail to allow user to create a new request due to too many outstanding requests", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).requestWithdrawal(oethUnits("1"));

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
        it("Fail to allow first user to claim a withdrawal due to too many outstanding requests", async () => {
          const { oethVault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = oethVault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
      });
      describe("with 0.02 ether slashed leaving 100 - 40 - 0.02 = 59.98 WETH in the strategy", () => {
        beforeEach(async () => {
          const { weth } = fixture;

          // Simulate slash event of 0.001 ethers
          await weth
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(addresses.dead, oethUnits("0.02"));
        });
        it("Should have total value of zero", async () => {
          // 100 from mints - 99 outstanding withdrawals - 0.001 from slashing = 0.999 total value
          expect(await fixture.oethVault.totalValue()).to.equal(
            oethUnits("0.98")
          );
        });
        it("Fail to allow user to create a new 1 WETH request due to too many outstanding requests", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).requestWithdrawal(oethUnits("1"));

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });

        it("Fail to allow user to create a new 0.01 WETH request due to insolvency check", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault
            .connect(matt)
            .requestWithdrawal(oethUnits("0.01"));

          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
        it("Fail to allow first user to claim a withdrawal due to insolvency check", async () => {
          const { oethVault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = oethVault.connect(daniel).claimWithdrawal(0);

          // diff = 1 total supply / 0.98 assets = 1.020408163265306122 which is > 1 maxSupplyDiff
          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
      });
    });
  });
});
