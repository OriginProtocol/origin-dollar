const { expect } = require("chai");

const {
  units,
  ousdUnits,
  advanceBlocks,
  advanceTime,
  isCI,
} = require("../helpers");
const { createFixtureLoader, aaveFixture } = require("../_fixture");
const { impersonateAndFund } = require("../../utils/signers");

describe.skip("ForkTest: Aave Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(aaveFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Mint", function () {
    it("Should deploy USDT in Aave", async function () {
      const { josh, usdt } = fixture;
      await mintTest(fixture, josh, usdt, "200000");
    });
  });

  describe("Redeem", function () {
    it("Should redeem from Aave", async () => {
      const { vault, ousd, usdt, anna } = fixture;

      await vault.connect(anna).rebase();

      const supplyBeforeMint = await ousd.totalSupply();

      const amount = "30100";

      // Mint with USDT
      await vault
        .connect(anna)
        .mint(usdt.address, await units(amount, usdt), 0);

      const currentSupply = await ousd.totalSupply();
      const supplyAdded = currentSupply.sub(supplyBeforeMint);
      expect(supplyAdded).to.approxEqualTolerance(ousdUnits("30000"), 1);

      const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

      // Now try to redeem 30k
      await vault.connect(anna).redeem(ousdUnits("30000"), 0);

      // User balance should be down by 30k
      const newBalance = await ousd.connect(anna).balanceOf(anna.address);
      expect(newBalance).to.approxEqualTolerance(
        currentBalance.sub(ousdUnits("30000")),
        1
      );

      const newSupply = await ousd.totalSupply();
      const supplyDiff = currentSupply.sub(newSupply);

      expect(supplyDiff).to.approxEqualTolerance(ousdUnits("30000"), 1);
    });
  });

  describe("Withdraw", function () {
    it("Should be able to withdraw USDT from strategy", async function () {
      const { franck, usdt } = fixture;
      await withdrawTest(fixture, franck, usdt, "5000");
    });

    it("Should be able to withdrawAll from strategy", async function () {
      const { matt, usdc, vault, usdt, aaveStrategy } = fixture;
      const vaultSigner = await impersonateAndFund(vault.address);
      const amount = "110000";

      const usdcUnits = await units(amount, usdc);
      const usdtUnits = await units(amount, usdt);

      await vault.connect(matt).mint(usdt.address, usdtUnits, 0);
      await vault.connect(matt).mint(usdc.address, usdcUnits, 0);

      await vault.connect(matt).rebase();
      await vault.connect(matt).allocate();

      const vaultUsdtBefore = await usdt.balanceOf(vault.address);
      const vaultUsdcBefore = await usdc.balanceOf(vault.address);

      const stratBalUsdc = await aaveStrategy.checkBalance(usdc.address);
      const stratBalUsdt = await aaveStrategy.checkBalance(usdt.address);

      await aaveStrategy.connect(vaultSigner).withdrawAll();

      const vaultUsdtDiff =
        (await usdt.balanceOf(vault.address)) - vaultUsdtBefore;
      const vaultUsdcDiff =
        (await usdc.balanceOf(vault.address)) - vaultUsdcBefore;

      expect(vaultUsdcDiff).to.approxEqualTolerance(stratBalUsdc, 1);
      expect(vaultUsdtDiff).to.approxEqualTolerance(stratBalUsdt, 1);

      expect(await aaveStrategy.checkBalance(usdc.address)).to.equal("0");
      expect(await aaveStrategy.checkBalance(usdt.address)).to.equal("0");
    });
  });

  // set it as a last test that executes because we advance time and theat
  // messes with recency of oracle prices
  describe("Supply Revenue", function () {
    it("Should get supply interest", async function () {
      const { anna, usdt, aaveStrategy } = fixture;
      await mintTest(fixture, anna, usdt, "110000");

      const currentBalance = await aaveStrategy.checkBalance(usdt.address);

      await advanceTime(60 * 60 * 24 * 365);
      await advanceBlocks(10000);

      const balanceAfter1Y = await aaveStrategy.checkBalance(usdt.address);

      const diff = balanceAfter1Y.sub(currentBalance);
      expect(diff).to.be.gt(0);
    });
  });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { vault, ousd, aaveStrategy } = fixture;

  await vault.connect(user).rebase();
  await vault.connect(user).allocate();

  const unitAmount = await units(amount, asset);

  const currentSupply = await ousd.totalSupply();
  const currentBalance = await ousd.connect(user).balanceOf(user.address);
  const currentStrategyBalance = await aaveStrategy.checkBalance(asset.address);

  // Mint OUSD w/ asset
  await vault.connect(user).mint(asset.address, unitAmount, 0);
  await vault.connect(user).allocate();

  const newBalance = await ousd.connect(user).balanceOf(user.address);
  const newSupply = await ousd.totalSupply();
  const newStrategyBalance = await aaveStrategy.checkBalance(asset.address);

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 1);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const ousdUnitAmount = ousdUnits(amount);

  expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount, 1);

  const liquidityDiff = newStrategyBalance.sub(currentStrategyBalance);

  // Should have liquidity in Aave
  expect(liquidityDiff).to.approxEqualTolerance(await units(amount, asset), 1);
}

async function withdrawTest(fixture, user, asset, amount) {
  const { vault, aaveStrategy } = fixture;
  if (amount) {
    await mintTest(fixture, user, asset, amount);
  }

  const assetUnits = amount
    ? await units(amount, asset)
    : await aaveStrategy.checkBalance(asset.address);
  const vaultAssetBalBefore = await asset.balanceOf(vault.address);
  const vaultSigner = await impersonateAndFund(vault.address);

  await aaveStrategy
    .connect(vaultSigner)
    .withdraw(vault.address, asset.address, assetUnits);
  const vaultAssetBalDiff = (await asset.balanceOf(vault.address)).sub(
    vaultAssetBalBefore
  );

  expect(vaultAssetBalDiff).to.approxEqualTolerance(assetUnits, 1);
}
