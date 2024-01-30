const { expect } = require("chai");

const {
  units,
  oethUnits,
  advanceBlocks,
  advanceTime,
  isCI,
} = require("../helpers");
const { createFixtureLoader, oethMorphoAaveFixture } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");

describe("ForkTest: Morpho Aave OETH Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(oethMorphoAaveFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Mint", function () {
    it("Should deploy WETH in Morpho Aave", async function () {
      const { domen, weth } = fixture;
      await mintTest(fixture, domen, weth, "3.56");
    });
  });

  describe("Redeem", function () {
    it("Should redeem from Morpho", async () => {
      const { oethVault, oeth, weth, daniel } = fixture;

      // Mint some ETH
      const amount = "1.23";
      const amountUnits = oethUnits(amount);
      await oethVault.connect(daniel).mint(weth.address, amountUnits, 0);
      await oethVault.connect(daniel).allocate();
      await oethVault.connect(daniel).rebase();

      const currentSupply = await oeth.totalSupply();
      const currentBalance = await oeth
        .connect(daniel)
        .balanceOf(daniel.address);

      // Now try to redeem 1.23 OETH
      await oethVault.connect(daniel).redeem(amountUnits, 0);

      await oethVault.connect(daniel).allocate();
      await oethVault.connect(daniel).rebase();

      // User balance should be down by 1.23 OETH
      const newBalance = await oeth.connect(daniel).balanceOf(daniel.address);
      expect(newBalance).to.approxEqualTolerance(
        currentBalance.sub(amountUnits),
        1
      );

      const newSupply = await oeth.totalSupply();
      const supplyDiff = currentSupply.sub(newSupply);

      expect(supplyDiff).to.approxEqualTolerance(amountUnits, 1);
    });
  });

  describe("Supply Revenue", function () {
    it("Should get supply interest", async function () {
      const { josh, weth, oethMorphoAaveStrategy } = fixture;
      await mintTest(fixture, josh, weth, "2.3333444");

      const currentBalance = await oethMorphoAaveStrategy.checkBalance(
        weth.address
      );

      await advanceTime(60 * 60 * 24 * 365);
      await advanceBlocks(10000);

      const balanceAfter1Y = await oethMorphoAaveStrategy.checkBalance(
        weth.address
      );

      const diff = balanceAfter1Y.sub(currentBalance);
      expect(diff).to.be.gt(0);
    });
  });

  describe("Withdraw", function () {
    it("Should be able to withdraw WETH from strategy", async function () {
      const { matt, weth } = fixture;
      await withdrawTest(fixture, matt, weth, "2.7655");
    });

    it("Should be able to withdrawAll from strategy", async function () {
      const { weth, oethVault, oethMorphoAaveStrategy } = fixture;
      const oethVaultSigner = await impersonateAndFund(oethVault.address);

      // The strategy already has some funds allocated on Mainnet,
      // so the following lines are unnecessary

      // // Remove funds so no residual funds get allocated
      // await weth
      //   .connect(oethVaultSigner)
      //   .transfer(franck.address, await weth.balanceOf(oethVault.address));

      // // Mint some OETH
      // await mintTest(fixture, franck, weth, amount);

      const existingBalance = await oethMorphoAaveStrategy.checkBalance(
        weth.address
      );
      const oethVaultWETHBefore = (await weth.balanceOf(oethVault.address)).add(
        existingBalance
      );

      await oethMorphoAaveStrategy.connect(oethVaultSigner).withdrawAll();

      const oethVaultWETHAfter = await weth.balanceOf(oethVault.address);
      expect(oethVaultWETHAfter).to.approxEqualTolerance(
        oethVaultWETHBefore,
        1
      );
    });
  });
});

async function mintTest(fixture, user, asset, amount = "0.34") {
  const { oethVault, oeth, oethMorphoAaveStrategy } = fixture;

  await oethVault.connect(user).allocate();
  await oethVault.connect(user).rebase();

  const unitAmount = await units(amount, asset);

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentMorphoBalance = await oethMorphoAaveStrategy.checkBalance(
    asset.address
  );

  // Mint OETH w/ asset
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newMorphoBalance = await oethMorphoAaveStrategy.checkBalance(
    asset.address
  );

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(oethUnits(amount), 2);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const oethUnitAmount = oethUnits(amount);
  expect(supplyDiff).to.approxEqualTolerance(oethUnitAmount, 1);

  const morphoLiquidityDiff = newMorphoBalance.sub(currentMorphoBalance);

  // Should have liquidity in Morpho
  expect(morphoLiquidityDiff).to.approxEqualTolerance(
    await units(amount, asset),
    1
  );
}

async function withdrawTest(fixture, user, asset, amount = "3.876") {
  const { oethVault, oethMorphoAaveStrategy } = fixture;
  await mintTest(fixture, user, asset, amount);

  const assetUnits = await units(amount, asset);
  const oethVaultAssetBalBefore = await asset.balanceOf(oethVault.address);
  const oethVaultSigner = await impersonateAndFund(oethVault.address);

  await oethMorphoAaveStrategy
    .connect(oethVaultSigner)
    .withdraw(oethVault.address, asset.address, assetUnits);
  const oethVaultAssetBalDiff = (await asset.balanceOf(oethVault.address)).sub(
    oethVaultAssetBalBefore
  );

  expect(oethVaultAssetBalDiff).to.approxEqualTolerance(assetUnits, 1);
}
