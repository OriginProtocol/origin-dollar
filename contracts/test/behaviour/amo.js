const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { units } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - oToken: the OToken. eg OETH or USDD
 * - vaultAsset: the token of the vault collateral asset. eg WETH, frxETH, DAI/USDC/USDT
 * - poolAsset: the token of the Curve or Balancer asset. eg ETH, frxETH, 3Crv
 * - pool: The Curve or Balancer pool contract
 * - vault: Vault or OETHVault contract
 * - assetDivisor: 3 for the OUSD AMO strategy that uses the 3Pool. Others are 1
 * @example
    shouldBehaveLikeStrategy(() => ({
      ...fixture,
    strategy: fixture.convexEthMetaStrategy,
    oToken: fixture.OETH,
    vaultAsset: fixture.weth,
    poolAssetAddress: addresses.ETH,
    pool: fixture.CurveOethEthPool,
    vault: fixture.oethVault,
    assetDivisor: 1
    }));
 */
const shouldBehaveLikeAmo = (context) => {
  describe("AMO behaviour", () => {
    it("Should have AMO configured", async () => {
      const { pool, oToken, poolAssetAddress, vaultAsset, strategy } =
        await context();
      expect(await strategy.lpToken()).to.equal(pool.address);
      expect(await strategy.vaultAsset()).to.equal(vaultAsset.address);
      expect(await strategy.poolAsset()).to.equal(poolAssetAddress);
      expect(await strategy.oToken()).to.equal(oToken.address);
    });
    describe("with no assets in the strategy", () => {
      it("Should be able to deposit each asset", async () => {
        const { assetDivisor, oToken, strategy, vault, vaultAsset } =
          await context();

        const vaultSigner = await impersonateAndFund(vault.address);

        const depositAmountStr = "1000";
        const depositAmount = await units(depositAmountStr, vaultAsset);
        // mint some test assets to the vault
        await vaultAsset.connect(vaultSigner).mint(depositAmount);
        // and then transfer to the strategy
        await vaultAsset
          .connect(vaultSigner)
          .transfer(strategy.address, depositAmount);

        // prettier-ignore
        const tx = await strategy
            .connect(vaultSigner)["deposit(address,uint256)"](vaultAsset.address, depositAmount);

        const platformAddress = await strategy.assetToPToken(
          vaultAsset.address
        );
        await expect(tx)
          .to.emit(strategy, "Deposit")
          .withArgs(vaultAsset.address, platformAddress, depositAmount);
        await expect(tx)
          .to.emit(strategy, "Deposit")
          .withArgs(
            oToken.address,
            platformAddress,
            parseUnits(depositAmountStr)
          );

        // Has to be 2x the deposit amount
        expect(await strategy.checkBalance(vaultAsset.address)).to.be.eq(
          depositAmount.mul(2).div(assetDivisor)
        );
      });
      it("Should be able to deposit all asset together", async () => {
        const { assetDivisor, oToken, strategy, vault, vaultAsset } =
          await context();

        const vaultSigner = await impersonateAndFund(vault.address);

        const depositAmountStr = "1000";
        const depositAmount = await units(depositAmountStr, vaultAsset);
        // mint some test assets to the vault
        await vaultAsset.connect(vaultSigner).mint(depositAmount);
        // and then transfer to the strategy
        await vaultAsset
          .connect(vaultSigner)
          .transfer(strategy.address, depositAmount);

        const tx = await strategy.connect(vaultSigner).depositAll();

        const platformAddress = await strategy.assetToPToken(
          vaultAsset.address
        );
        await expect(tx)
          .to.emit(strategy, "Deposit")
          .withArgs(vaultAsset.address, platformAddress, depositAmount);
        await expect(tx)
          .to.emit(strategy, "Deposit")
          .withArgs(
            oToken.address,
            platformAddress,
            parseUnits(depositAmountStr)
          );

        // Has to be 2x the deposit amount
        expect(await strategy.checkBalance(vaultAsset.address)).to.be.eq(
          depositAmount.mul(2).div(assetDivisor)
        );
      });
    });
    // pool balanced with OTokens and vault assets
    // Should deposit assets. OTokens == assets
    // Should withdraw remove assets. OTokens == assets
    // Should not mintAndAddOTokens
    // Should not removeAndBurnOTokens
    // Should not removeOnlyAssets
    // pool tilted a little to OTokens
    // Should deposit assets. OTokens == assets
    // Should withdraw remove assets. OTokens > assets
    // Should not mintAndAddOTokens
    // Should removeAndBurnOTokens
    // Should not removeAndBurnOTokens a lot of OTokens
    // Should not removeOnlyAssets
    // pool tilted a lot to OTokens
    // Should deposit assets. OTokens == assets
    // Should withdraw remove assets. OTokens > assets
    // Should not mintAndAddOTokens
    // Should removeAndBurnOTokens
    // Should not removeAndBurnOTokens a lot of OTokens
    // Should not removeOnlyAssets
    // pool tilted a little to vault assets
    // Should deposit assets. OTokens > assets
    // Should withdraw remove assets. OTokens < assets
    // Should mintAndAddOTokens
    // Should not mintAndAddOTokens a lot of OTokens
    // Should not removeAndBurnOTokens
    // Should removeOnlyAssets
    // Should not removeOnlyAssets a lot of assets
    // pool tilted a lot to vault assets
    // Should deposit assets. OTokens == 2x assets
    // Should withdraw remove assets. OTokens < assets
    // Should mintAndAddOTokens
    // Should not mintAndAddOTokens a lot of OTokens
    // Should not removeAndBurnOTokens
    // Should removeOnlyAssets
    // Should not removeOnlyAssets a lot of assets
  });
};

module.exports = {
  shouldBehaveLikeAmo,
};
