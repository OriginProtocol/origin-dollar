const { expect } = require("chai");

const { units, ousdUnits, isCI } = require("../helpers");
const { createFixtureLoader } = require("../_fixture");
const { withCRV3TitledOUSDMetapool } = require("../_metastrategies-fixtures");

// The OUSD AMO has been removed
describe.skip("ForkTest: Convex 3pool/OUSD Meta Strategy - Titled to 3CRV", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  const loadFixture = createFixtureLoader(withCRV3TitledOUSDMetapool);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Mint", function () {
    it("Should stake USDT in Curve gauge via metapool", async function () {
      const { josh, usdt } = fixture;
      await mintTest(fixture, josh, usdt, "200000");
    });

    it("Should stake USDC in Curve gauge via metapool", async function () {
      const { matt, usdc } = fixture;
      await mintTest(fixture, matt, usdc, "110000");
    });

    it("Should stake DAI in Curve gauge via metapool", async function () {
      const { anna, dai } = fixture;
      await mintTest(fixture, anna, dai, "110000");
    });
  });

  describe("Redeem", function () {
    it("Should redeem", async () => {
      const { vault, ousd, usdt, usdc, dai, anna, OUSDmetaStrategy } = fixture;

      await vault.connect(anna).allocate();

      const supplyBeforeMint = await ousd.totalSupply();

      const amount = "10000";

      // Mint with all three assets
      for (const asset of [usdt, usdc, dai]) {
        await vault
          .connect(anna)
          .mint(asset.address, await units(amount, asset), 0);
      }

      await vault.connect(anna).allocate();

      // we multiply it by 3 because 1/3 of balance is represented by each of the assets
      const strategyBalance = (
        await OUSDmetaStrategy.checkBalance(dai.address)
      ).mul(3);

      // min 1x 3crv + 1x printed OUSD: (10k + 10k) * (usdt + usdc) = 40k
      expect(strategyBalance).to.be.gte(ousdUnits("40000"));

      // Total supply should be up by at least (10k x 2) + (10k x 2) + 10k = 50k
      const currentSupply = await ousd.totalSupply();
      const supplyAdded = currentSupply.sub(supplyBeforeMint);
      expect(supplyAdded).to.be.gte(ousdUnits("49999"));

      const currentBalance = await ousd.connect(anna).balanceOf(anna.address);

      // Now try to redeem the amount
      await vault.connect(anna).redeem(ousdUnits("29900"), 0);

      // User balance should be down by 30k
      const newBalance = await ousd.connect(anna).balanceOf(anna.address);
      expect(newBalance).to.approxEqualTolerance(
        currentBalance.sub(ousdUnits("29900")),
        1
      );

      const newSupply = await ousd.totalSupply();
      const supplyDiff = currentSupply.sub(newSupply);

      expect(supplyDiff).to.be.gte(ousdUnits("29900"));
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
  const ousdUnitAmount = ousdUnits(amount);

  // The pool is titled to 3CRV by a million
  // It should have added amount*3 supply
  expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount.mul(3), 5);

  // Ensure some LP tokens got staked under OUSDMetaStrategy address
  const newRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(OUSDmetaStrategy.address);
  const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
    currentRewardPoolBalance
  );
  // Should have staked the LP tokens for USDT and USDC
  expect(rewardPoolBalanceDiff).to.be.gte(ousdUnits(amount).mul(3).div(2));
}
