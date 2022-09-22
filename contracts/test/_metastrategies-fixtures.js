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

async function addLiquidity(fixture, ousdAmount, crv3Liquidity, receiver) {
  const { domen, ousdMetaPool } = fixture;

  receiver = receiver ? receiver.getAddress() : domen.getAddress();

  const addSignature = "add_liquidity(uint256[2],uint256,address)";
  const addMethod = await ousdMetaPool.connect(domen)[addSignature];
  addMethod([ousdAmount, crv3Liquidity], 0, receiver);
}

async function removeAllLiquidity(fixture, user) {
  const { ousdMetaPool } = fixture;

  const address = user.getAddress();
  const removeSign = "remove_liquidity(uint256,uint256[2])";
  const removeMethod = await ousdMetaPool.connect(user)[removeSign];
  removeMethod(ousdMetaPool.balanceOf(address), ["0", "0"]);
}

/**
 * Removes liquidity by first removing the required amount of 3crvLPTokens
 * and then removes OUSD tokens with remaining metapoolLP
 */
async function removeLiquidityImbalanced(fixture, user, crv3Liquidity) {
  const { ousdMetaPool } = fixture;

  const address = user.getAddress();
  const removeImbalanceSign = "remove_liquidity_imbalance(uint256[2],uint256)";
  await ousdMetaPool.connect(user)[removeImbalanceSign](
    ["0", crv3Liquidity],
    crv3Liquidity.mul("12").div("10") // 20% of tolerance
  );

  // Remaining metapool LP user has is used to remove liquidity to get OUSD
  const removeOneCoinSign = "remove_liquidity_one_coin(uint256,int128,uint256)";
  await ousdMetaPool.connect(user)[removeOneCoinSign](
    await ousdMetaPool.balanceOf(address),
    0, // pool token ID. 0: OUSD, 1: 3CRV
    0 // Burn none
  );
}

async function withLiquidityOnBalancedPool() {
  const fixture = await loadFixture(withDefaultStrategiesSet);
  // 10k OUSD
  const ousdAmount = ousdUnits("10000");
  // $10k of 3CRV
  const crv3Liquidity = await get3CRVLiquidity(fixture, ousdAmount);

  // Daniel has added balanced liquidity
  await addLiquidity(fixture, ousdAmount, crv3Liquidity, fixture.daniel);

  // Franck has added imbalanced liquidity
  await addLiquidity(fixture, ousdAmount, crv3Liquidity.div(2), fixture.franck);

  // Balance metapool
  await balanceMetaPool(fixture);

  return fixture;
}

async function withLiquidityOnOUSDTitledPool() {
  const fixture = await loadFixture(withBalancedMetaPool);
  // 10k OUSD
  const ousdAmount = ousdUnits("10000");
  // $10k of 3CRV
  const crv3Liquidity = await get3CRVLiquidity(fixture, ousdAmount);

  // Daniel has added balanced liquidity
  await addLiquidity(fixture, ousdAmount, crv3Liquidity, fixture.daniel);

  // Franck has added imbalanced liquidity
  await addLiquidity(fixture, ousdAmount, crv3Liquidity.div(2), fixture.franck);

  // Tilt to OUSD
  await tiltToOUSD(fixture);

  return fixture;
}

async function withLiquidityOn3CRVTitledPool() {
  const fixture = await loadFixture(withBalancedMetaPool);
  // 10k OUSD
  const ousdAmount = ousdUnits("10000");
  // $10k of 3CRV
  const crv3Liquidity = await get3CRVLiquidity(fixture, ousdAmount);

  // Daniel has added balanced liquidity
  await addLiquidity(fixture, ousdAmount, crv3Liquidity, fixture.daniel);

  // Franck has added imbalanced liquidity
  await addLiquidity(fixture, ousdAmount, crv3Liquidity.div(2), fixture.franck);

  // Tilt to 3CRV
  await tiltTo3CRV(fixture);

  return fixture;
}

module.exports = {
  convexMetaVaultFixture,
  withDefaultStrategiesSet,

  withBalancedMetaPool,
  balanceMetaPool,
  withLiquidityOnBalancedPool,

  withCRV3TitledMetapool,
  tiltTo3CRV,
  withLiquidityOn3CRVTitledPool,

  withOUSDTitledMetapool,
  tiltToOUSD,
  withLiquidityOnOUSDTitledPool,

  addLiquidity,
  removeAllLiquidity,
  removeLiquidityImbalanced,
  get3CRVLiquidity,
};
