const hre = require("hardhat");
const { ethers } = hre;
const { loadFixture } = require("ethereum-waffle");
const { ousdUnits } = require("./helpers");
const { convexMetaVaultFixture, resetAllowance } = require("./_fixture");
const addresses = require("../utils/addresses");

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
  const { ousdMetaPool } = fixture;
  await _balanceMetaPool(fixture, ousdMetaPool);
}

async function _balanceMetaPool(fixture, metapool) {
  const { vault, domen } = fixture;

  // Balance metapool
  const mainCoinBalance = await metapool.balances(0);
  const crv3Balance = await metapool.balances(1);

  // Dollar value of coins
  const mainCoinValue = await _getCoinValue(metapool, mainCoinBalance);
  const crv3Value = await get3CRVValue(fixture, crv3Balance);

  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  const exchagneMethod = await metapool.connect(domen)[exchangeSign];

  if (mainCoinValue.gt(crv3Value)) {
    const diffInDollars = mainCoinValue.sub(crv3Value);
    const liquidityDiff = await _getCoinLiquidity(
      metapool,
      diffInDollars.div(2)
    );

    // Tilt to 3CRV
    await exchagneMethod(1, 0, liquidityDiff, 0);
  } else if (crv3Value.gt(mainCoinValue)) {
    const diffInDollars = crv3Value.sub(mainCoinValue);
    const liquidityDiff = await get3CRVLiquidity(fixture, diffInDollars.div(2));

    // Tilt to Main Token
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
  const { ousdMetaPool } = fixture;

  await tiltTo3CRV_Metapool(fixture, ousdMetaPool, amount);
}

/* Tilt towards 3CRV by checking liquidity
 */
async function tiltTo3CRV_Metapool_automatic(
  fixture
) {
  const { vault, domen, metapool, threePoolToken, metapoolCoin } = fixture;
  
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [metapool.address],
  });
  
  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [metapool.address, "0x1bc16d674ec8000000"],
  });

  const metapoolSigner = await ethers.provider.getSigner(metapool.address);
  await resetAllowance(threePoolToken, metapoolSigner, metapool.address);

  // 90% of main coin pool liquidity
  const shareOfThreePoolCoinBalance = (
    await threePoolToken.balanceOf(metapool.address)
  )
    .mul(ousdUnits("0.9"))
    .div(ousdUnits("1"));

  const mainCoinBalance = await metapoolCoin.balanceOf(metapool.address);

  let count = 0;
  let acc = ethers.BigNumber.from("0");
  /* self deploy 90% of threepool coin liquidity until pool has at least five times
   * the 3crvLP liquidity comparing to main coin.
   */
  while(acc.lt((await metapool.balances(0)).mul(5))) {
    // Tilt to main token
    await metapool.connect(metapoolSigner)[
      // eslint-disable-next-line
      "add_liquidity(uint256[2],uint256)"
    ]([0, shareOfThreePoolCoinBalance], 0);

    acc = acc.add(shareOfThreePoolCoinBalance);
  }


}

/* Just triple the main token liquidity in a flaky manner where the pool
 * re-deploys its own liquidity
 */
async function tiltToMainToken(fixture) {
  const { metapool, metapoolCoin, threePoolToken } = fixture;

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [metapool.address],
  });
  
  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [metapool.address, "0x1bc16d674ec8000000"],
  });

  const metapoolSigner = await ethers.provider.getSigner(metapool.address);
  await resetAllowance(metapoolCoin, metapoolSigner, metapool.address);
  // 90% of main coin pool liquidity
  const shareOfMainCoinBalance = (
    await metapoolCoin.balanceOf(metapool.address)
  )
    .mul(ousdUnits("0.9"))
    .div(ousdUnits("1"));

  const threeCrvBalance = await threePoolToken.balanceOf(metapool.address);

  let count = 0;
  let acc = ethers.BigNumber.from("0");

  /* self deploy 90% of main coin liquidity until at least five times the main coin liquidity
   * comparing to 3crv is deployed to the pool.
   */
  while(acc.lt((await metapool.balances(1)).mul(5))) {
    // Tilt to main token
    await metapool.connect(metapoolSigner)[
      // eslint-disable-next-line
      "add_liquidity(uint256[2],uint256)"
    ]([shareOfMainCoinBalance, 0], 0);

    acc = acc.add(shareOfMainCoinBalance);
  }
}

async function tiltTo3CRV_Metapool(fixture, metapool, amount) {
  const { vault, domen } = fixture;

  // Balance metapool
  await _balanceMetaPool(fixture, metapool);

  amount = amount || ousdUnits("1000000");

  // Tilt to 3CRV by a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  await metapool.connect(domen)[exchangeSign](1, 0, amount.div(2), 0);

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

  tiltTo3CRV_Metapool,
  tiltTo3CRV_Metapool_automatic,
  tiltToMainToken,

  getOUSDLiquidity,
  get3CRVLiquidity,
};
