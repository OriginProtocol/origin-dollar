const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const { units, oethUnits, forkOnlyDescribe } = require("../helpers");
const { convexOETHMetaVaultFixture } = require("../_fixture");

forkOnlyDescribe("ForkTest: OETH Curve Metapool Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  describe("Mint", function () {
    it("Should stake WETH in Curve guage via metapool", async function () {
      const fixture = await loadFixture(convexOETHMetaVaultFixture);
      console.log(
        "fixture.cvxRewardStakerAddress",
        fixture.cvxRewardStakerAddress
      );
      const { josh, weth } = fixture;
      await mintTest(fixture, josh, weth, "5");
    });
  });
});

async function mintTest(fixture, user, asset, amount = "3") {
  const {
    oethVault,
    oeth,
    weth,
    cvxRewardStakerAddress,
    ConvexEthMetaStrategy,
    cvxRewardPool,
  } = fixture;

  const unitAmount = await units(amount, asset);

  await oethVault.connect(user).rebase();
  await oethVault.connect(user).allocate();

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);

  const currentRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(ConvexEthMetaStrategy.address);

  // Mint OUSD w/ asset
  await asset.connect(user).approve(oethVault.address, unitAmount);
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  // Ensure user has correct balance (w/ 1% slippage tolerance)
  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const balanceDiff = newBalance.sub(currentBalance);
  expect(balanceDiff).to.approxEqualTolerance(oethUnits(amount), 1);

  // Supply checks
  const newSupply = await oeth.totalSupply();
  const supplyDiff = newSupply.sub(currentSupply);

  expect(supplyDiff).to.approxEqualTolerance(oethUnits(amount).mul(2), 5);

  //Ensure some LP tokens got staked under OUSDMetaStrategy address
  const newRewardPoolBalance = await cvxRewardPool
    .connect(user)
    .balanceOf(ConvexEthMetaStrategy.address);
  const rewardPoolBalanceDiff = newRewardPoolBalance.sub(
    currentRewardPoolBalance
  );

  /* Should have staked the LP tokens
   * 
   * half of the LP tokens are received because the price of the lp token
   * is multiplied by 2 ( https://github.com/curvefi/curve-factory-crypto/blob/ecf60c360e230d6a4ba1e5cb31ab8b61d545f452/contracts/CurveCryptoSwap2ETH.vy#L1308-L1312)
   *
   * TO BE CONFIRMED: this is because the pool doesn't actually have 2 underlying
   * tokens but only one coupled with ETH.
   */
  expect(rewardPoolBalanceDiff).to.approxEqualTolerance(oethUnits(amount), 1);
}
