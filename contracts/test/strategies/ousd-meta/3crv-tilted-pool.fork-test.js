const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { units, ousdUnits, forkOnlyDescribe } = require("../../helpers");
const {
  withCRV3TitledOUSDMetapool,
} = require("../../_metastrategies-fixtures");

forkOnlyDescribe(
  "Convex 3pool/OUSD Meta Strategy - Titled to 3CRV",
  function () {
    this.timeout(0);

    describe("Mint", function () {
      it("Should stake USDT in Cruve guage via metapool", async function () {
        const fixture = await loadFixture(withCRV3TitledOUSDMetapool);
        const { josh, usdt } = fixture;
        await mintTest(fixture, josh, usdt, "200000");
      });

      it("Should stake USDC in Cruve guage via metapool", async function () {
        const fixture = await loadFixture(withCRV3TitledOUSDMetapool);
        const { matt, usdc } = fixture;
        await mintTest(fixture, matt, usdc, "110000");
      });

      it("Should NOT stake DAI in Cruve guage via metapool", async function () {
        const fixture = await loadFixture(withCRV3TitledOUSDMetapool);
        const { anna, dai } = fixture;
        await mintTest(fixture, anna, dai, "110000");
      });
    });

    describe("Redeem", function () {
      it("Should redeem", async () => {
        const { vault, ousd, usdt, usdc, dai, anna } = await loadFixture(
          withCRV3TitledOUSDMetapool
        );

        const supplyBeforeMint = await ousd.totalSupply();

        const amount = "10000";

        // Mint with all three assets
        for (const asset of [usdt, usdc, dai]) {
          await vault
            .connect(anna)
            .mint(asset.address, await units(amount, asset), 0);
        }

        // Total supply should be up by (10k x 2) + (10k x 2) + 10k = 50k
        const currentSupply = await ousd.totalSupply();
        const supplyAdded = currentSupply.sub(supplyBeforeMint);
        expect(supplyAdded).to.be.gte("50000");

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

        expect(supplyDiff).to.be.gte(ousdUnits("30000"));
      });
    });
  }
);

async function mintTest(fixture, user, asset, amount = "30000") {
  const { vault, ousd, usdt, usdc, dai, OUSDmetaStrategy, cvxRewardPool } =
    fixture;

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
  if ([usdt.address, usdc.address].includes(asset.address)) {
    // It should have added amount*3 supply
    // (in case of USDT/USDC)
    expect(supplyDiff).to.approxEqualTolerance(
      ousdUnitAmount.mul(3),
      5
    );
  } else {
    // 1x for DAI
    expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount, 1);
  }

  // Ensure some LP tokens got staked under OUSDMetaStrategy address
  const newRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(OUSDmetaStrategy.address);
  const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
    currentRewardPoolBalance
  );
  if (asset.address === dai.address) {
    // Should not have staked when minted with DAI
    expect(rewardPoolBalanceDiff).to.equal("0");
  } else {
    // Should have staked the LP tokens for USDT and USDC
    expect(rewardPoolBalanceDiff).to.be.gte(ousdUnits(amount).mul(3).div(2));
  }
}
