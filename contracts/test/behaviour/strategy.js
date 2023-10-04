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
    describe("With assets in the strategy", () => {
      beforeEach(async () => {
        const { assets, strategy, vault } = await context();
        const strategySigner = await impersonateAndFund(strategy.address);
        const vaultSigner = await impersonateAndFund(vault.address);

        // deposit some assets into the strategy so we can withdraw them
        for (const asset of assets) {
          const depositAmount = await units("10000", asset);
          // mint some test assets directly into the strategy contract
          await asset.connect(strategySigner).mint(depositAmount);
        }
        await strategy.connect(vaultSigner).depositAll();
      });
      it("Should be able to withdraw each asset", async () => {
        const { assets, strategy, vault } = await context();
        const platformAddress = await strategy.platformAddress();
        const vaultSigner = await impersonateAndFund(vault.address);

        for (const asset of assets) {
          const withdrawAmount = await units("8000", asset);

          const tx = await strategy
            .connect(vaultSigner)
            .withdraw(vault.address, asset.address, withdrawAmount);

          await expect(tx)
            .to.emit(strategy, "Withdrawal")
            .withArgs(asset.address, platformAddress, withdrawAmount);
        }
      });
      it("Should be able to withdraw all assets", async () => {
        const { assets, strategy, vault } = await context();
        const platformAddress = await strategy.platformAddress();
        const vaultSigner = await impersonateAndFund(vault.address);

        const tx = await strategy.connect(vaultSigner).withdrawAll();

        for (const asset of assets) {
          const withdrawAmount = await units("10000", asset);
          await expect(tx)
            .to.emit(strategy, "Withdrawal")
            .withArgs(asset.address, platformAddress, withdrawAmount);
        }
      });
    });
  });
};

module.exports = {
  shouldBehaveLikeStrategy,
};
