const { loadFixture } = require("ethereum-waffle");
const { ousdUnits } = require("./helpers");
const { convexMetaVaultFixture } = require("./_fixture");

// NOTE: This can cause a change in setup from mainnet.
// However, mint/redeem tests, without any changes, are tested
// in vault.fork-test.js, so this should be fine.

async function withDefaultOUSDMetapoolStrategiesSet() {
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

async function withBalancedOUSDMetaPool() {
  const fixture = await loadFixture(withDefaultOUSDMetapoolStrategiesSet);

  await balanceOUSDMetaPool(fixture);

  return fixture;
}

async function balanceOUSDMetaPool(fixture) {
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

async function withCRV3TitledOUSDMetapool() {
  const fixture = await loadFixture(withDefaultOUSDMetapoolStrategiesSet);

  await tiltTo3CRV_OUSDMetapool(fixture);

  return fixture;
}

async function tiltTo3CRV_OUSDMetapool(fixture, amount) {
  const { vault, domen, ousdMetaPool } = fixture;

  // Balance metapool
  await balanceOUSDMetaPool(fixture);

  amount = amount || ousdUnits("1000000");

  // Tilt to 3CRV by a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  await ousdMetaPool.connect(domen)[exchangeSign](1, 0, amount.div(2), 0);

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function withOUSDTitledMetapool() {
  const fixture = await loadFixture(withDefaultOUSDMetapoolStrategiesSet);

  await tiltToOUSD_OUSDMetapool(fixture);

  return fixture;
}

async function tiltToOUSD_OUSDMetapool(fixture, amount) {
  const { vault, domen, ousdMetaPool } = fixture;

  // Balance metapool
  await balanceOUSDMetaPool(fixture);

  amount = amount || ousdUnits("1000000");

  // Tilt to 3CRV by a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  await ousdMetaPool.connect(domen)[exchangeSign](0, 1, amount.div(2), 0);

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function getOUSDLiquidity(fixture, ousdAmount) {
  const { ousdMetaPool } = fixture;
  return _getCoinLiquidity(ousdMetaPool, ousdAmount);
}

async function get3CRVLiquidity(fixture, crv3Amount) {
  const { threepoolSwap } = fixture;
  return _getCoinLiquidity(threepoolSwap, crv3Amount);
}

async function _getCoinLiquidity(poolSwap, coinAmount) {
  const vPrice = await poolSwap.get_virtual_price();
  return coinAmount.div(vPrice).mul(ousdUnits("1"));
}

async function getOUSDValue(fixture, ousdAmount) {
  const { ousdMetaPool } = fixture;
  return _getCoinValue(ousdMetaPool, ousdAmount);
}

async function _getCoinValue(metapool, coinAmount) {
  const vPrice = await metapool.get_virtual_price();
  return coinAmount.mul(vPrice).div(ousdUnits("1"));
}

async function get3CRVValue(fixture, crv3Amount) {
  const { threepoolSwap } = fixture;
  return _getCoinValue(threepoolSwap, crv3Amount);
}

module.exports = {
  convexMetaVaultFixture,
  withDefaultOUSDMetapoolStrategiesSet,

  withBalancedOUSDMetaPool,
  balanceOUSDMetaPool,

  withCRV3TitledOUSDMetapool,
  tiltTo3CRV_OUSDMetapool,

  withOUSDTitledMetapool,
  tiltToOUSD_OUSDMetapool,

  getOUSDLiquidity,
  get3CRVLiquidity,
};
