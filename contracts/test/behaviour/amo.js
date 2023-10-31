const { expect } = require("chai");

const { units } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - assets: array of tokens to test
 * - valueAssets: optional array of assets that work for checkBalance and withdraw. defaults to assets
 * - vault: Vault or OETHVault contract
 * @example
    shouldBehaveLikeStrategy(() => ({
      ...fixture,
    strategy: fixture.convexEthMetaStrategy,
    oToken: fixture.OETH,
    vaultAsset: fixture.weth,
    curveAsset: addresses.ETH,
    curvePool: fixture.curveOethEthPool,
    curveLpToken: fixture.curveOethEthPool,
    vault: fixture.oethVault,
    }));
 */
const shouldBehaveLikeAmo = (context) => {
  describe.only("AMO behaviour", () => {
    it("Should have AMO configured", async () => {
      const { curveLpToken, oToken, vaultAsset, strategy } = await context();
      expect(await strategy.lpToken()).to.equal(curveLpToken.address);
      expect(await strategy.asset()).to.equal(vaultAsset.address);
      expect(await strategy.oToken()).to.equal(oToken.address);
    });
    describe("with no assets in the strategy", () => {
      it("Should be able to deposit each asset", async () => {
        const { oToken, strategy, vault, vaultAsset } = await context();

        const vaultSigner = await impersonateAndFund(vault.address);

        const depositAmount = await units("1000", vaultAsset);
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
          .withArgs(oToken.address, platformAddress, depositAmount);

        // Has to be 2x the deposit amount
        expect(await strategy.checkBalance(vaultAsset.address)).to.be.eq(
          depositAmount.mul(2)
        );
      });
      it("Should be able to deposit all asset together", async () => {
        const { oToken, strategy, vault, vaultAsset } = await context();

        const vaultSigner = await impersonateAndFund(vault.address);

        const depositAmount = await units("1000", vaultAsset);
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
          .withArgs(oToken.address, platformAddress, depositAmount);

        // Has to be 2x the deposit amount
        expect(await strategy.checkBalance(vaultAsset.address)).to.be.eq(
          depositAmount.mul(2)
        );
      });
    });
    // Curve pool balanced with OTokens and vault assets
    // Should deposit assets. OTokens == assets
    // Should withdraw remove assets. OTokens == assets
    // Should not mintAndAddOTokens
    // Should not removeAndBurnOTokens
    // Should not removeOnlyAssets
    // Curve pool tilted a little to OTokens
    // Should deposit assets. OTokens == assets
    // Should withdraw remove assets. OTokens > assets
    // Should not mintAndAddOTokens
    // Should removeAndBurnOTokens
    // Should not removeAndBurnOTokens a lot of OTokens
    // Should not removeOnlyAssets
    // Curve pool tilted a lot to OTokens
    // Should deposit assets. OTokens == assets
    // Should withdraw remove assets. OTokens > assets
    // Should not mintAndAddOTokens
    // Should removeAndBurnOTokens
    // Should not removeAndBurnOTokens a lot of OTokens
    // Should not removeOnlyAssets
    // Curve pool tilted a little to vault assets
    // Should deposit assets. OTokens > assets
    // Should withdraw remove assets. OTokens < assets
    // Should mintAndAddOTokens
    // Should not mintAndAddOTokens a lot of OTokens
    // Should not removeAndBurnOTokens
    // Should removeOnlyAssets
    // Should not removeOnlyAssets a lot of assets
    // Curve pool tilted a lot to vault assets
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
