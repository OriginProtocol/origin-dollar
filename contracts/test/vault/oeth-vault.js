const { expect } = require("chai");
const hre = require("hardhat");

const { createFixtureLoader, oethDefaultFixture } = require("../_fixture");
const { parseUnits } = require("ethers/lib/utils");
const { deployWithConfirmation } = require("../../utils/deploy");
const { oethUnits } = require("../helpers");

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
      const { oethVault, weth, daniel } = fixture;
      const tx = oethVault
        .connect(daniel)
        .redeem(weth.address, oethUnits("1023232323232"), "0");
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
});
