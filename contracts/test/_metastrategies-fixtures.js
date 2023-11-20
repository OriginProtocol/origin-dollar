const hre = require("hardhat");
const { ethers } = hre;
const { formatUnits } = require("ethers/lib/utils");

const { ousdUnits, units } = require("./helpers");
const { convexMetaVaultFixture, resetAllowance } = require("./_fixture");
const addresses = require("../utils/addresses");
const erc20Abi = require("./abi/erc20.json");
const { impersonateAndFund } = require("../utils/signers");
const { setERC20TokenBalance } = require("./_fund");

const log = require("../utils/logger")("test:fixtures:strategies:meta");

// NOTE: This can cause a change in setup from mainnet.
// However, mint/redeem tests, without any changes, are tested
// in vault.fork-test.js, so this should be fine.

async function withDefaultOUSDMetapoolStrategiesSet() {
  const fixture = await convexMetaVaultFixture();

  const { vault, timelock, dai, usdt, usdc, OUSDmetaStrategy, daniel } =
    fixture;

  await vault
    .connect(timelock)
    .setAssetDefaultStrategy(dai.address, OUSDmetaStrategy.address);

  await vault
    .connect(timelock)
    .setAssetDefaultStrategy(usdt.address, OUSDmetaStrategy.address);

  await vault
    .connect(timelock)
    .setAssetDefaultStrategy(usdc.address, OUSDmetaStrategy.address);

  fixture.cvxRewardPool = await ethers.getContractAt(
    "IRewardStaking",
    addresses.mainnet.CVXRewardsPool
  );

  // Also, mint some OUSD so that there's some in the pool
  const amount = "20000";
  for (const asset of [usdt, usdc, dai]) {
    await vault
      .connect(daniel)
      .mint(asset.address, await units(amount, asset), 0);
  }

  return fixture;
}

async function withBalancedOUSDMetaPool() {
  const fixture = await withDefaultOUSDMetapoolStrategiesSet();

  await balanceOUSDMetaPool(fixture);

  return fixture;
}

async function balanceOUSDMetaPool(fixture) {
  const { ousdMetaPool } = fixture;

  log(`Metapool balances before being balanced`);
  const balancesBefore = await fixture.ousdMetaPool.get_balances();
  const coinOne3CrvValueBefore = await get3CRVLiquidity(
    fixture,
    balancesBefore[0]
  );
  log(
    `Metapool balance 0: ${formatUnits(
      coinOne3CrvValueBefore
    )} 3CRV (${formatUnits(balancesBefore[0])} OUSD)`
  );
  log(`Metapool balance 1: ${formatUnits(balancesBefore[1])} 3CRV`);

  await _balanceMetaPool(fixture, ousdMetaPool);

  log(`Metapool balances after being balanced`);
  const balancesAfter = await fixture.ousdMetaPool.get_balances();
  const coinOne3CrvValueAfter = await get3CRVLiquidity(
    fixture,
    balancesAfter[0]
  );
  log(
    `Metapool balance 0: ${formatUnits(
      coinOne3CrvValueAfter
    )} 3CRV (${formatUnits(balancesAfter[0])} OUSD)`
  );
  log(`Metapool balance 1: ${formatUnits(balancesAfter[1])} 3CRV`);
}

async function _balanceMetaPool(fixture, metapool) {
  const { vault, domen } = fixture;

  // Balance metapool
  const ousdBalance = await metapool.balances(0);
  const crv3Balance = await metapool.balances(1);

  // 3Crv value of coins
  const coinOne3CrvValue = await get3CRVLiquidity(fixture, ousdBalance);
  const coinTwo3CrvValue = crv3Balance;

  const coinOneContract = await ethers.getContractAt(
    erc20Abi,
    await metapool.coins(0)
  );
  const coinTwoContract = await ethers.getContractAt(
    erc20Abi,
    await metapool.coins(1)
  );

  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  const metapoolSigner = await impersonateAndFund(metapool.address);
  /* let metapool perform the exchange on itself. This is somewhat dirty, but is also the
   * best assurance that the liquidity of both coins for balancing are going to be
   * available.
   */
  const exchangeMethod = await metapool.connect(metapoolSigner)[exchangeSign];
  await resetAllowance(coinOneContract, metapoolSigner, metapool.address);
  await resetAllowance(coinTwoContract, metapoolSigner, metapool.address);

  if (coinOne3CrvValue.gt(coinTwo3CrvValue)) {
    // There is more OUSD than 3CRV
    const crvAmount = coinOne3CrvValue.sub(coinTwo3CrvValue);
    await impersonateAndFund(domen.address, "1000000");
    await setERC20TokenBalance(domen.address, coinTwoContract, crvAmount, hre);

    log(`About to add ${formatUnits(crvAmount)} 3CRV to the OUSD Metapool`);
    // prettier-ignore
    await metapool
        .connect(domen)["add_liquidity(uint256[2],uint256)"]([0, crvAmount], 0);
  } else if (coinTwo3CrvValue.gt(coinOne3CrvValue)) {
    const diffInDollars = coinTwo3CrvValue.sub(coinOne3CrvValue);
    const liquidityDiff = await get3CRVLiquidity(fixture, diffInDollars.div(2));

    // Tilt to Main Token
    log(`About to exchange ${formatUnits(liquidityDiff)} OUSD for 3CRV`);
    await exchangeMethod(0, 1, liquidityDiff, 0);
  }

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function withCRV3TitledOUSDMetapool() {
  const fixture = await withDefaultOUSDMetapoolStrategiesSet();

  await tiltTo3CRV_OUSDMetapool(fixture);

  return fixture;
}

async function tiltTo3CRV_OUSDMetapool(fixture, amount) {
  const { ousdMetaPool } = fixture;

  await tiltTo3CRV_Metapool(fixture, ousdMetaPool, amount);
}

/* Tilt towards 3CRV by checking liquidity
 */
async function tiltTo3CRV_Metapool_automatic(fixture) {
  const { metapool, threePoolToken } = fixture;

  const metapoolSigner = await impersonateAndFund(metapool.address);
  await resetAllowance(threePoolToken, metapoolSigner, metapool.address);

  // 90% of main coin pool liquidity
  const shareOfThreePoolCoinBalance = (
    await threePoolToken.balanceOf(metapool.address)
  )
    .mul(ousdUnits("0.9"))
    .div(ousdUnits("1"));

  let acc = ethers.BigNumber.from("0");
  /* self deploy 90% of threepool coin liquidity until pool has at least five times
   * the 3crvLP liquidity comparing to main coin.
   */
  while (acc.lt((await metapool.balances(0)).mul(5))) {
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
  const { metapool, metapoolCoin } = fixture;

  const metapoolSigner = await impersonateAndFund(metapool.address);
  await resetAllowance(metapoolCoin, metapoolSigner, metapool.address);
  // 90% of main coin pool liquidity
  const shareOfMainCoinBalance = (
    await metapoolCoin.balanceOf(metapool.address)
  )
    .mul(ousdUnits("0.9"))
    .div(ousdUnits("1"));

  let acc = ethers.BigNumber.from("0");

  /* self deploy 90% of main coin liquidity until at least five times the main coin liquidity
   * comparing to 3crv is deployed to the pool.
   */
  while (acc.lt((await metapool.balances(1)).mul(5))) {
    // Tilt to main token
    await metapool.connect(metapoolSigner)[
      // eslint-disable-next-line
      "add_liquidity(uint256[2],uint256)"
    ]([shareOfMainCoinBalance, 0], 0);

    acc = acc.add(shareOfMainCoinBalance);
  }
}

async function tiltTo3CRV_Metapool(fixture, metapool, amount) {
  const { vault, domen, ousdMetaPool } = fixture;

  // Balance metapool
  await _balanceMetaPool(fixture, metapool);
  amount = amount || ousdUnits("1000000");

  // Tilt to 3CRV by a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  // make metapool make exchange on itself. It should always have enough OUSD/3crv to do this
  const metapoolSigner = await impersonateAndFund(ousdMetaPool.address);

  await metapool.connect(metapoolSigner)[exchangeSign](1, 0, amount.div(2), 0);

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

async function withOUSDTitledMetapool() {
  const fixture = await withDefaultOUSDMetapoolStrategiesSet();

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
  // make metapool make exchange on itself. It should always have enough OUSD/3crv to do this
  const metapoolSigner = await impersonateAndFund(ousdMetaPool.address);

  await ousdMetaPool
    .connect(metapoolSigner)
    // eslint-disable-next-line
    [exchangeSign](0, 1, amount.div(2), 0);

  await vault.connect(domen).allocate();
  await vault.connect(domen).rebase();
}

// Convert 3CRV value to OUSD/3CRV Metapool LP tokens
async function getOUSDLiquidity(fixture, crv3Amount) {
  const { ousdMetaPool } = fixture;
  return _getCoinLiquidity(ousdMetaPool, crv3Amount);
}

// Convert USD value to 3Pool LP tokens
async function get3CRVLiquidity(fixture, usdAmount) {
  const { threepoolSwap } = fixture;
  return _getCoinLiquidity(threepoolSwap, usdAmount);
}

// Convert pool value, eg USD or 3CRV, to Pool LP tokens
async function _getCoinLiquidity(pool, value) {
  const vPrice = await pool.get_virtual_price();
  // LP tokens  = value / virtual price * 1e18
  return value.div(vPrice).mul(ousdUnits("1"));
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
