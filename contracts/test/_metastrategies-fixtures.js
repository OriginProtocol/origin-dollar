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

  // Dollar value of coins
  const ousdValue = await getOUSDValue(fixture, ousdBalance);
  const crv3Value = await get3CRVValue(fixture, crv3Balance);

  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  const exchagneMethod = await ousdMetaPool.connect(domen)[exchangeSign];

  if (ousdValue.gt(crv3Value)) {
    const diffInDollars = ousdValue.sub(crv3Value);
    const liquidityDiff = await getOUSDLiquidity(fixture, diffInDollars.div(2));

    // Tilt to 3CRV
    await exchagneMethod(1, 0, liquidityDiff, 0);
  } else if (crv3Value.gt(ousdValue)) {
    const diffInDollars = crv3Value.sub(ousdValue);
    const liquidityDiff = await get3CRVLiquidity(fixture, diffInDollars.div(2));

    // Tilt to OUSD
    await exchagneMethod(0, 1, liquidityDiff, 0);
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

  amount = amount || ousdUnits("1000000");

  // Tilt to 3CRV by a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  await ousdMetaPool.connect(domen)[exchangeSign](1, 0, amount.div(2), 0);

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

  amount = amount || ousdUnits("1000000");

  // Tilt to 3CRV by a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  await ousdMetaPool.connect(domen)[exchangeSign](0, 1, amount.div(2), 0);

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function getOUSDLiquidity(fixture, ousdAmount) {
  const { ousdMetaPool } = fixture;
  const vPrice = await ousdMetaPool.get_virtual_price();
  return ousdAmount.div(vPrice).mul(ousdUnits("1"));
}

async function get3CRVLiquidity(fixture, crv3Amount) {
  const { threepoolSwap } = fixture;
  const vPrice = await threepoolSwap.get_virtual_price();
  return crv3Amount.div(vPrice).mul(ousdUnits("1"));
}

async function getOUSDValue(fixture, ousdAmount) {
  const { ousdMetaPool } = fixture;
  const vPrice = await ousdMetaPool.get_virtual_price();
  return ousdAmount.mul(vPrice).div(ousdUnits("1"));
}

async function get3CRVValue(fixture, crv3Amount) {
  const { threepoolSwap } = fixture;
  const vPrice = await threepoolSwap.get_virtual_price();
  return crv3Amount.mul(vPrice).div(ousdUnits("1"));
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

  getOUSDLiquidity,
  get3CRVLiquidity,
};
