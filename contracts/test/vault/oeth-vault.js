const { expect } = require("chai");
const hre = require("hardhat");

const { createFixtureLoader, oethDefaultFixture } = require("../_fixture");
const { parseUnits } = require("ethers/lib/utils");
const { deployWithConfirmation } = require("../../utils/deploy");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");

const oethFixture = createFixtureLoader(oethDefaultFixture);

describe("OETH Vault", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await oethFixture();
  });

  describe("Mint", () => {
    it("should mint with WETH", async () => {
      const { oethVault, weth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      await weth.connect(josh).approve(oethVault.address, amount);

      const tx = await oethVault
        .connect(josh)
        .mint(weth.address, amount, minOeth);

      await expect(tx)
        .to.emit(oethVault, "Mint")
        .withArgs(josh.address, amount);
    });

    it("should not mint with any other asset", async () => {
      const { oethVault, frxETH, stETH, reth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      for (const asset of [frxETH, stETH, reth]) {
        await asset.connect(josh).approve(oethVault.address, amount);
        const tx = oethVault.connect(josh).mint(asset.address, amount, minOeth);

        await expect(tx).to.be.revertedWith("Unsupported asset for minting");
      }
    });

    it("should revert if mint amount is zero", async () => {
      const { oethVault, weth, josh } = fixture;

      const tx = oethVault.connect(josh).mint(weth.address, "0", "0");
      await expect(tx).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert if capital is paused", async () => {
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

      // Mint some WETH
      await weth.connect(domen).approve(oethVault.address, oethUnits("10000"));
      await oethVault.connect(domen).mint(weth.address, oethUnits("100"), "0");

      expect(await weth.balanceOf(mockStrategy.address)).to.eq(
        oethUnits("100")
      );
    });
  });

  describe("Redeem", () => {
    it("should return only WETH in redeem calculations", async () => {
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

    it("should revert if WETH index isn't cached", async () => {
      const { frxETH, weth } = fixture;

      await deployWithConfirmation("MockOETHVault", [weth.address]);
      const mockVault = await hre.ethers.getContract("MockOETHVault");

      await mockVault.supportAsset(frxETH.address);

      const tx = mockVault.calculateRedeemOutputs(oethUnits("12343"));
      await expect(tx).to.be.revertedWith("WETH Asset index not cached");
    });

    it("should update total supply correctly", async () => {
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

    it("Should withdraw from strategy if necessary", async () => {
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

      const vaultBalanceBefore = await weth.balanceOf(oethVault.address);
      const stratBalanceBefore = await weth.balanceOf(mockStrategy.address);
      const userBalanceBefore = await weth.balanceOf(domen.address);

      // Withdraw something more than what the Vault holds
      await oethVault.connect(domen).redeem(oethUnits("12.55"), "0");

      const vaultBalanceAfter = await weth.balanceOf(oethVault.address);
      const stratBalanceAfter = await weth.balanceOf(mockStrategy.address);
      const userBalanceAfter = await weth.balanceOf(domen.address);

      expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(oethUnits("12.55"));

      expect(stratBalanceBefore.sub(stratBalanceAfter)).to.eq(
        oethUnits("12.55")
      );

      expect(vaultBalanceBefore).to.eq(vaultBalanceAfter);
    });

    it("should revert on liquidity error", async () => {
      const { oethVault, daniel } = fixture;
      const tx = oethVault
        .connect(daniel)
        .redeem(oethUnits("1023232323232"), "0");
      await expect(tx).to.be.revertedWith("Liquidity error");
    });
  });

  describe("Config", () => {
    it("should allow caching WETH index", async () => {
      const { oethVault, weth, governor } = fixture;

      await oethVault.connect(governor).cacheWETHAssetIndex();

      const index = (await oethVault.wethAssetIndex()).toNumber();

      const assets = await oethVault.getAllAssets();

      expect(assets[index]).to.equal(weth.address);
    });

    it("should not allow anyone other than Governor to change cached index", async () => {
      const { oethVault, strategist } = fixture;

      const tx = oethVault.connect(strategist).cacheWETHAssetIndex();
      await expect(tx).to.be.revertedWith("Caller is not the Governor");
    });

    it("should revert if WETH is not an supported asset", async () => {
      const { frxETH, weth } = fixture;
      const { deployerAddr } = await hre.getNamedAccounts();
      const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

      await deployWithConfirmation("MockOETHVault", [weth.address]);
      const mockVault = await hre.ethers.getContract("MockOETHVault");

      await mockVault.supportAsset(frxETH.address);

      const tx = mockVault.connect(sDeployer).cacheWETHAssetIndex();
      await expect(tx).to.be.revertedWith("Invalid WETH Asset Index");
    });
  });

  describe("Remove Asset", () => {
    it("should allow removing a single asset", async () => {
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

    it("should allow removing multiple assets", async () => {
      const { oethVault, frxETH, reth, governor } = fixture;

      const vaultAdmin = await ethers.getContractAt(
        "OETHVaultAdmin",
        oethVault.address
      );
      const assetCount = (await oethVault.getAssetCount()).toNumber();

      const tx = await oethVault
        .connect(governor)
        .removeAssets([frxETH.address, reth.address]);

      const allAssets = await oethVault.getAllAssets();
      expect(allAssets.length).to.equal(assetCount - 2);

      for (const asset of [frxETH, reth]) {
        await expect(tx)
          .to.emit(vaultAdmin, "AssetRemoved")
          .withArgs(asset.address);
        await expect(tx)
          .to.emit(vaultAdmin, "AssetDefaultStrategyUpdated")
          .withArgs(asset.address, addresses.zero);

        expect(await oethVault.isSupportedAsset(asset.address)).to.be.false;
        expect(await oethVault.checkBalance(asset.address)).to.equal(0);
        expect(await oethVault.assetDefaultStrategies(asset.address)).to.equal(
          addresses.zero
        );

        expect(allAssets).to.not.contain(asset.address);

        const config = await oethVault.getAssetConfig(asset.address);
        expect(config.isSupported).to.be.false;
      }
    });

    it("should only allow governance to remove assets", async () => {
      const { oethVault, weth, strategist, josh } = fixture;

      for (const signer of [strategist, josh]) {
        let tx = oethVault.connect(signer).removeAsset(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");

        tx = oethVault.connect(signer).removeAssets([weth.address]);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("should revert if asset is not supported", async () => {
      const { oethVault, dai, governor } = fixture;
      const tx = oethVault.connect(governor).removeAsset(dai.address);

      await expect(tx).to.be.revertedWith("Asset not supported");
    });

    it("should revert if vault still holds the asset", async () => {
      const { oethVault, weth, governor, daniel } = fixture;

      await oethVault.connect(daniel).mint(weth.address, oethUnits("1"), "0");

      const tx = oethVault.connect(governor).removeAsset(weth.address);

      await expect(tx).to.be.revertedWith("Vault still holds asset");
    });
  });
});
