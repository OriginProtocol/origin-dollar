const { expect } = require("chai");

const { units, ousdUnits, isCI } = require("../helpers");
const { createFixtureLoader } = require("../_fixture");
const { withOUSDTitledMetapool } = require("../_metastrategies-fixtures");

// The OUSD AMO has been removed
describe.skip("ForkTest: Convex 3pool/OUSD Meta Strategy - Titled to OUSD", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(withOUSDTitledMetapool);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via metapool", async function () {
      const { josh, usdt } = fixture;
      await mintTest(fixture, josh, usdt, "100000");
    });

    it("Should stake USDC in Curve gauge via metapool", async function () {
      const { matt, usdc } = fixture;
      await mintTest(fixture, matt, usdc, "120000");
    });

    it("Should stake USDS in Curve gauge via metapool", async function () {
      const { anna, usds } = fixture;
      await mintTest(fixture, anna, usds, "110000");
    });
  });

  describe("Redeem", function () {
    it("Should redeem", async () => {
      const { vault, ousd, usdt, usdc, usds, anna, OUSDmetaStrategy } = fixture;

      await vault.connect(anna).allocate();

      const supplyBeforeMint = await ousd.totalSupply();
      const strategyBalanceBeforeMint = (
        await OUSDmetaStrategy.checkBalance(usds.address)
      ).mul(3);

      const amount = "10000";

      // Mint with all three assets
      for (const asset of [usdt, usdc, usds]) {
        await vault
          .connect(anna)
          .mint(asset.address, await units(amount, asset), 0);
      }

      await vault.connect(anna).allocate();

      // we multiply it by 3 because 1/3 of balance is represented by each of the assets
      const strategyBalance = (
        await OUSDmetaStrategy.checkBalance(usds.address)
      ).mul(3);
      const strategyBalanceChange = strategyBalance.sub(
        strategyBalanceBeforeMint
      );

      // min 1x 3crv + 1x printed OUSD: (10k + 10k + 10k) * (usdt + usdc + usds) = 60k
      expect(strategyBalanceChange).to.be.gte(ousdUnits("59500"));

      // Total supply should be up by at least (10k x 2) + (10k x 2) + (10k x 2) = 60k
      const currentSupply = await ousd.totalSupply();
      const supplyAdded = currentSupply.sub(supplyBeforeMint);
      expect(supplyAdded).to.be.gte(ousdUnits("59500"));

      const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

      // Now try to redeem the amount
      const redeemAmount = ousdUnits("10000");
      await vault.connect(anna).redeem(redeemAmount, 0);

      // User balance should be down by 10k
      const newBalance = await ousd.connect(anna).balanceOf(anna.address);
      expect(newBalance).to.approxEqualTolerance(
        currentBalance.sub(redeemAmount),
        1
      );

      const newSupply = await ousd.totalSupply();
      const supplyDiff = currentSupply.sub(newSupply);

      expect(supplyDiff).to.be.gte(redeemAmount);
    });
  });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { vault, ousd, OUSDmetaStrategy, cvxRewardPool } = fixture;
  await vault.connect(user).allocate();
  await vault.connect(user).rebase();

  const unitAmount = await units(amount, asset);

  const currentSupply = await ousd.totalSupply();
  const currentBalance = await ousd.connect(user).balanceOf(user.address);
  const currentRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(OUSDmetaStrategy.address);

  // Mint OUSD w/ asset
  await vault.connect(user).mint(asset.address, unitAmount, 0);
  await vault.connect(user).allocate();

  // Ensure user has correct balance (w/ 1% slippage tolerance)
  const newBalance = await ousd.connect(user).balanceOf(user.address);
  const balanceDiff = newBalance.sub(currentBalance);
  expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 2);

  // Supply checks
  const newSupply = await ousd.totalSupply();
  const supplyDiff = newSupply.sub(currentSupply);

  // The pool is titled to 3CRV by a millions
  // It should have added 2 times the OUSD amount.
  // 1x for 3poolLp tokens and 1x for minimum amount of OUSD printed
  expect(supplyDiff).to.approxEqualTolerance(ousdUnits(amount).mul(2), 5);

  // Ensure some LP tokens got staked under OUSDMetaStrategy address
  const newRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(OUSDmetaStrategy.address);
  const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
    currentRewardPoolBalance
  );
  // Should have staked the LP tokens for USDT and USDC
  expect(rewardPoolBalanceDiff).to.approxEqualTolerance(
    ousdUnits(amount).mul(2),
    5
  );
}
