const { expect } = require("chai");

const { units } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - assets: array of tokens to test
 * - vault: 
 * @example
    shouldBehaveLikeStrategy(() => ({
        ...fixture,
        strategy: fixture.convexStrategy,
        assets: [fixture.dai, fixture.usdc, fixture.usdt],
        vault: fixture.vault,
    }));
 */
const shouldBehaveLikeStrategy = (context) => {
  const mint = async (amount, asset) => {
    const { anna, vault } = context();
    await asset.connect(anna).mint(await units(amount, asset));
    await asset
      .connect(anna)
      .approve(vault.address, await units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, await units(amount, asset), 0);
  };

  describe("Strategy behaviour", () => {
    it("Should be a supported asset", async () => {
      const { assets, strategy } = await context();

      for (const asset of assets) {
        expect(await strategy.supportsAsset(asset.address)).to.be.true;
      }
    });
    it("Should be able to deposit each asset", async () => {
      const { assets, strategy, vault } = await context();

      const platformAddress = await strategy.platformAddress();
      const strategySigner = await impersonateAndFund(strategy.address);
      const vaultSigner = await impersonateAndFund(vault.address);

      for (const asset of assets) {
        const depositAmount = await units("1000", asset);
        // mint some test assets directly into the strategy contract
        await asset.connect(strategySigner).mint(depositAmount);

        const tx = await strategy
          .connect(vaultSigner)
          .deposit(asset.address, depositAmount);

        await expect(tx)
          .to.emit(strategy, "Deposit")
          .withArgs(asset.address, platformAddress, depositAmount);
      }
    });
    it("Should be able to deposit all asset together", async () => {
      const { assets, strategy, vault } = await context();

      const platformAddress = await strategy.platformAddress();
      const strategySigner = await impersonateAndFund(strategy.address);
      const vaultSigner = await impersonateAndFund(vault.address);

      for (const [i, asset] of assets.entries()) {
        const depositAmount = await units("1000", asset);
        // mint some test assets directly into the strategy contract
        await asset.connect(strategySigner).mint(depositAmount.mul(i + 1));
      }

      const tx = await strategy.connect(vaultSigner).depositAll();

      for (const [i, asset] of assets.entries()) {
        const depositAmount = await units("1000", asset);
        await expect(tx)
          .to.emit(strategy, "Deposit")
          .withArgs(asset.address, platformAddress, depositAmount.mul(i + 1));
      }
    });
    it.skip("Should be able to withdraw each asset", async () => {
      const { dai, usdc, usdt, assets, strategy, vault } = await context();

      await mint("10000", dai);
      await mint("20000", usdc);
      await mint("30000", usdt);

      const platformAddress = await strategy.platformAddress();
      const vaultSigner = await impersonateAndFund(vault.address);

      for (const [i, asset] of Object.entries(assets)) {
        const withdrawAmount = (await units("10000", asset)).mul(i + 1);

        const tx = await strategy
          .connect(vaultSigner)
          .withdraw(vault.address, asset.address, withdrawAmount);

        await expect(tx)
          .to.emit(strategy, "Withdraw")
          .withArgs(asset.address, platformAddress, withdrawAmount);
      }
    });
  });
};

module.exports = {
  shouldBehaveLikeStrategy,
};
