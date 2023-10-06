const { expect } = require("chai");
const { BigNumber } = require("ethers");

const { impersonateAndFund } = require("../../utils/signers");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - assets: array of tokens to test
 * - vault: Vault or OETHVault contract
 * - harvester: Harvester or OETHHarvester contract
 * @example
    shouldBehaveLikeMultiAssetStrategy(() => ({
      ...fixture,
      strategy: fixture.convexFrxEthWethStrategy,
      vault: fixture.oethVault,
      harvester: fixture.oethHarvester,
      assets: [fixture.weth, fixture.frxETH],
      amounts: [parseUnits("100"), parseUnits("200")],
    }));
 */
const shouldBehaveLikeMultiAssetStrategy = (context) => {
  describe("Multi-asset Strategy behaviour", () => {
    it("Should allow vault to multi-deposit using all assets", async () => {
      const { assets, amounts, strategy, vault } = context();
      await assetDepositMultiple(assets, amounts, strategy, vault);
    });
    it("Should allow vault to multi-deposit using reversed assets", async () => {
      const { assets, amounts, strategy, vault } = context();
      await assetDepositMultiple(assets.reverse(), amounts, strategy, vault);
    });
    it("Should allow vault to multi-deposit with only first asset", async () => {
      const { assets, amounts, strategy, vault } = context();
      await assetDepositMultiple([assets[0]], [amounts[0]], strategy, vault);
    });
    it("Should allow vault to multi-deposit with only last asset", async () => {
      const { assets, amounts, strategy, vault } = context();
      await assetDepositMultiple(
        [assets[assets.length - 1]],
        [amounts[assets.length - 1]],
        strategy,
        vault
      );
    });
    it("Should not allow multi-deposit by non-vault", async () => {
      const {
        assets,
        amounts,
        strategy,
        harvester,
        governor,
        strategist,
        matt,
      } = context();

      const harvesterSigner = await impersonateAndFund(harvester.address);
      for (const signer of [harvesterSigner, governor, strategist, matt]) {
        await expect(
          strategy.connect(signer)["deposit(address[],uint256[])"](
            assets.map((a) => a.address),
            amounts
          )
        ).to.revertedWith("Caller is not the Vault");
      }
    });
  });
};

const assetDepositMultiple = async (assets, amounts, strategy, vault) => {
  const strategySigner = await impersonateAndFund(strategy.address);
  const vaultSigner = await impersonateAndFund(vault.address);
  let average = BigNumber.from(0);
  for (const [i, asset] of assets.entries()) {
    // mint some test assets directly into the strategy contract
    await asset.connect(strategySigner).mint(amounts[i]);
    average = average.add(amounts[i]);
  }
  // Split across the number of assets in the pool
  average = average.div(2);

  // prettier-ignore
  const tx = await strategy
    .connect(vaultSigner)["deposit(address[],uint256[])"](
      assets.map(a => a.address),
      amounts
    );

  const platformAddress = await strategy.assetToPToken(assets[0].address);
  for (const [i, asset] of assets.entries()) {
    await expect(tx)
      .to.emit(strategy, "Deposit")
      .withArgs(asset.address, platformAddress, amounts[i]);

    expect(await strategy.checkBalance(asset.address)).to.be.eq(average);
  }
};

module.exports = {
  shouldBehaveLikeMultiAssetStrategy,
};
