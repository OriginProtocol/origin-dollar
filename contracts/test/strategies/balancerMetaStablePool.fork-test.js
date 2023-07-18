const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const {
  units,
  ousdUnits,
  forkOnlyDescribe,
  advanceBlocks,
  advanceTime,
} = require("../helpers");
const {
  balancerWstEthWethFixture,
  impersonateAndFundContract,
} = require("../_fixture");

forkOnlyDescribe("ForkTest: Balancer MetaStablePool stWeth/WETH Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(balancerWstEthWethFixture);
  });

  describe.only("Mint", function () {
    it("Should deploy WETH in Balancer MetaStablePool strategy", async function () {
      const { josh, weth } = fixture;
      await mintTest(fixture, josh, weth, "30");
    });

    it("Should deploy stETH in Balancer MetaStablePool strategy", async function () {
      const { josh, stETH } = fixture;
      await mintTest(fixture, josh, stETH, "30");
    });
  });

  // set it as a last test that executes because we advance time and theat
  // messes with recency of oracle prices
  describe("Supply Revenue", function () {

  });
});

async function mintTest(fixture, user, asset, amount = "30000") {
  const { oethVault, oeth, balancerWstEthWethStrategy } = fixture;

  await oethVault.connect(user).allocate();

  const unitAmount = await units(amount, asset);

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentBalancerBalance = await balancerWstEthWethStrategy.checkBalance(
    asset.address
  );

  // Mint OETH w/ asset
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newBalancerBalance = await balancerWstEthWethStrategy.checkBalance(asset.address);

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(ousdUnits(amount), 2);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const ousdUnitAmount = ousdUnits(amount);

  expect(supplyDiff).to.approxEqualTolerance(ousdUnitAmount, 1);

  const balancerLiquidityDiff = newBalancerBalance.sub(currentBalancerBalance);

  // Should have liquidity in Morpho
  expect(balancerLiquidityDiff).to.approxEqualTolerance(
    await units(amount, asset),
    1
  );
}

