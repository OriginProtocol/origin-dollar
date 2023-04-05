const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const {
  units,
  forkOnlyDescribe,
  oethUnits,
} = require("../helpers");
const {
  fraxETHStrategyForkedFixture,
  impersonateAndFundContract,
} = require("../_fixture");

forkOnlyDescribe("ForkTest: Frax ETH Strategy", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(fraxETHStrategyForkedFixture);
  });

  describe.only("Mint", function () {
    it("Should deploy fraxETH in Frax ETH Strategy", async function () {
      const { daniel, frxETH } = fixture;
      await mintTest(fixture, daniel, frxETH, "10");
    });
  });
});

async function mintTest(fixture, user, asset, amount = "10") {
  const { oethVault, oeth, fraxEthStrategy } = fixture;

  await oethVault.connect(user).allocate();

  const unitAmount = await units(amount, asset);

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentFrxStratBalance = await fraxEthStrategy.checkBalance(
    asset.address
  );

  // Mint OUSD w/ asset
  await oethVault.connect(user).mint(asset.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newFrxStratBalance = await fraxEthStrategy.checkBalance(asset.address);

  const balanceDiff = newBalance.sub(currentBalance);
  // Ensure user has correct balance (w/ 1% slippage tolerance)
  expect(balanceDiff).to.approxEqualTolerance(oethUnits(amount), 2);

  // Supply checks
  const supplyDiff = newSupply.sub(currentSupply);
  const oethUnitAmount = oethUnits(amount);

  expect(supplyDiff).to.approxEqualTolerance(oethUnitAmount, 1);

  const fraxBalanceDiff = newFrxStratBalance.sub(currentFrxStratBalance);

  // Should have liquidity in Morpho
  expect(fraxBalanceDiff).to.approxEqualTolerance(
    await units(amount, asset),
    1
  );
}
