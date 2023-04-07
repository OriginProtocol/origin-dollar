const { expect } = require("chai");

const { loadFixture } = require("ethereum-waffle");
const {
  units,
  forkOnlyDescribe,
  oethUnits,
  frxETHUnits,
  advanceTime,
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

  it("Should deposit fraxETH in Frax ETH Strategy", async function () {
    const { daniel, frxETH } = fixture;
    await mintTest(fixture, daniel, "10");
  });

  it("Should depositAll fraxETH in Frax ETH Strategy", async function () {
    const { daniel, frxETH } = fixture;
    await depositAllTest(fixture, daniel, "10");
  });

  it("Strategy should earn interest using fraxETH in Frax ETH Strategy", async function () {
    const { daniel, frxETH, sfrxETH, fraxEthStrategy } = fixture;
    await mintTest(fixture, daniel, "10");

    const frxETHAmount = await sfrxETH.convertToAssets(
      await sfrxETH.balanceOf(fraxEthStrategy.address)
    );

    frxETH.connect(daniel).transfer(sfrxETH.address, frxETHUnits("10"));
    sfrxETH.connect(daniel).syncRewards();
    // advance 1 month
    await advanceTime(60 * 60 * 24 * 7 * 4);

    const frxETHAmountDiff = (
      await sfrxETH.convertToAssets(
        await sfrxETH.balanceOf(fraxEthStrategy.address)
      )
    ).sub(frxETHAmount);
    // sfrxETH should be earning some rewards
    expect(frxETHAmountDiff).gt(frxETHUnits("0.00001"));
  });

  it("Should deploy fraxETH and then withdraw it", async function () {
    const { daniel, frxETH } = fixture;
    await withdrawTest(fixture, daniel, "10");
  });

  it("Should deploy fraxETH and then call withdraw all on the strategy", async function () {
    const { daniel, frxETH } = fixture;
    await withdrawAllTest(fixture, daniel, "10");
  });
});

async function depositAllTest(fixture, user, amount = "10") {
  const { oethVault, oeth, frxETH, fraxEthStrategy } = fixture;

  const assetUnits = await frxETHUnits(amount);
  const vaultAssetBalBefore = await frxETH.balanceOf(oethVault.address);
  const supply = await fraxEthStrategy.checkBalance(frxETH.address);
  const vaultSigner = await impersonateAndFundContract(oethVault.address);

  frxETH.connect(user).transfer(fraxEthStrategy.address, assetUnits);

  await fraxEthStrategy.connect(vaultSigner).depositAll();

  const supplyDiff = (await fraxEthStrategy.checkBalance(frxETH.address)).sub(
    supply
  );

  expect(supplyDiff).gt(assetUnits);
}

async function withdrawAllTest(fixture, user, amount = "10") {
  const { oethVault, oeth, frxETH, fraxEthStrategy } = fixture;
  const vaultSigner = await impersonateAndFundContract(oethVault.address);

  await mintTest(fixture, user, amount);

  const assetUnits = await frxETHUnits(amount);
  const strategyFrxETHBalance = await fraxEthStrategy.checkBalance(
    frxETH.address
  );
  const vaultAssetBalBefore = await frxETH.balanceOf(oethVault.address);

  await fraxEthStrategy.connect(vaultSigner).withdrawAll();

  const vaultAssetBalDiff = (await frxETH.balanceOf(oethVault.address)).sub(
    vaultAssetBalBefore
  );

  expect(vaultAssetBalDiff).to.approxEqualTolerance(strategyFrxETHBalance);
}

async function withdrawTest(fixture, user, amount = "10") {
  const { oethVault, oeth, frxETH, fraxEthStrategy } = fixture;
  await mintTest(fixture, user, amount);

  const assetUnits = await frxETHUnits(amount);
  const vaultAssetBalBefore = await frxETH.balanceOf(oethVault.address);
  const vaultSigner = await impersonateAndFundContract(oethVault.address);

  await fraxEthStrategy
    .connect(vaultSigner)
    .withdraw(oethVault.address, frxETH.address, assetUnits);
  const vaultAssetBalDiff = (await frxETH.balanceOf(oethVault.address)).sub(
    vaultAssetBalBefore
  );

  expect(vaultAssetBalDiff).to.approxEqualTolerance(assetUnits, 1);
}

async function mintTest(fixture, user, amount = "10") {
  const { oethVault, oeth, frxETH, fraxEthStrategy } = fixture;

  await oethVault.connect(user).allocate();

  const unitAmount = await units(amount, frxETH);

  const currentSupply = await oeth.totalSupply();
  const currentBalance = await oeth.connect(user).balanceOf(user.address);
  const currentFrxStratBalance = await fraxEthStrategy.checkBalance(
    frxETH.address
  );

  // Mint OUSD w/ asset
  await oethVault.connect(user).mint(frxETH.address, unitAmount, 0);
  await oethVault.connect(user).allocate();

  const newBalance = await oeth.connect(user).balanceOf(user.address);
  const newSupply = await oeth.totalSupply();
  const newFrxStratBalance = await fraxEthStrategy.checkBalance(frxETH.address);

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
    await units(amount, frxETH),
    1
  );
}
