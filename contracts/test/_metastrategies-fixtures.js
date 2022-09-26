const { loadFixture } = require("ethereum-waffle");
const { ousdUnits } = require("./helpers");
const { convexMetaVaultFixture } = require("./_fixture");

// NOTE: This can cause a change in setup from mainnet.
// However, mint/redeem tests, without any changes, are tested
// in vault.fork-test.js, so this should be fine.

async function withDefaultStrategiesSet() {
  const fixture = await loadFixture(convexMetaVaultFixture);

  const { vault, governor, usdt, usdc, OUSDmetaStrategy } = fixture;

  await vault
    .connect(governor)
    .setAssetDefaultStrategy(usdt.address, OUSDmetaStrategy.address);

  await vault
    .connect(governor)
    .setAssetDefaultStrategy(usdc.address, OUSDmetaStrategy.address);

  return fixture;
}

async function withBalancedMetaPool() {
  const fixture = await loadFixture(withDefaultStrategiesSet);

  await balanceMetaPool(fixture);

  return fixture;
}

async function balanceMetaPool(fixture) {
  const { vault, domen, ousdMetaPool } = fixture;

  // Balance metapool
  const ousdBalance = await ousdMetaPool.balances(0);
  const crv3Balance = await ousdMetaPool.balances(1);

  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  const exchagneMethod = await ousdMetaPool.connect(domen)[exchangeSign];
  if (ousdBalance.gt(crv3Balance)) {
    // Tilt to 3CRV
    await exchagneMethod(1, 0, ousdBalance.sub(crv3Balance).div(2), 0);
  } else if (crv3Balance.gt(ousdBalance)) {
    // Tilt to OUSD
    await exchagneMethod(0, 1, crv3Balance.sub(ousdBalance).div(2), 0);
  }

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function withCRV3TitledMetapool() {
  const fixture = await loadFixture(withDefaultStrategiesSet);

  await tiltTo3CRV(fixture);

  return fixture;
}

async function tiltTo3CRV(fixture, amount) {
  const { vault, domen, ousdMetaPool } = fixture;

  // Balance metapool
  await balanceMetaPool(fixture);

  amount = amount || ousdUnits("500000");

  // Tilt to 3CRV by half a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  await ousdMetaPool.connect(domen)[exchangeSign](1, 0, amount, 0);

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function withOUSDTitledMetapool() {
  const fixture = await loadFixture(withDefaultStrategiesSet);

  await tiltToOUSD(fixture);

  return fixture;
}

async function tiltToOUSD(fixture, amount) {
  const { vault, domen, ousdMetaPool } = fixture;

  // Balance metapool
  await balanceMetaPool(fixture);

  amount = amount || ousdUnits("500000");

  // Tilt to 3CRV by half a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  await ousdMetaPool.connect(domen)[exchangeSign](0, 1, amount, 0);

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function get3CRVLiquidity(fixture, crv3Amount) {
  const { threepoolSwap } = fixture;
  const vPrice = await threepoolSwap.get_virtual_price();
  return crv3Amount.div(vPrice).mul(ousdUnits("1"));
}

module.exports = {
  convexMetaVaultFixture,
  withDefaultStrategiesSet,

  withBalancedMetaPool,
  balanceMetaPool,

  withCRV3TitledMetapool,
  tiltTo3CRV,

  withOUSDTitledMetapool,
  tiltToOUSD,

  get3CRVLiquidity,
};
