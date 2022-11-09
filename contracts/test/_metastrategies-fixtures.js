const hre = require("hardhat");
const { ethers } = hre;
const { loadFixture } = require("ethereum-waffle");
const { ousdUnits } = require("./helpers");
<<<<<<< HEAD
const { convexMetaVaultFixture, resetAllowance } = require("./_fixture");
=======
const {
  convexMetaVaultFixture,
  resetAllowance,
  impersonateAndFundContract,
} = require("./_fixture");
const erc20Abi = require("./abi/erc20.json");
>>>>>>> origin/master

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

<<<<<<< HEAD
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  const exchagneMethod = await metapool.connect(domen)[exchangeSign];
=======
  const coinOneContract = await ethers.getContractAt(
    erc20Abi,
    await metapool.coins(0)
  );
  const coinTwoContract = await ethers.getContractAt(
    erc20Abi,
    await metapool.coins(1)
  );

  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
  const metapoolSigner = await impersonateAndFundContract(metapool.address);
  /* let metapool perform the exchange on itself. This is somewhat dirty, but is also the
   * best assurance that the liquidity of both coins for balancing are going to be
   * available.
   */
  const exchangeMethod = await metapool.connect(metapoolSigner)[exchangeSign];
  await resetAllowance(coinOneContract, metapoolSigner, metapool.address);
  await resetAllowance(coinTwoContract, metapoolSigner, metapool.address);
>>>>>>> origin/master

  if (mainCoinValue.gt(crv3Value)) {
    const diffInDollars = mainCoinValue.sub(crv3Value);
    const liquidityDiff = await _getCoinLiquidity(
      metapool,
      diffInDollars.div(2)
    );

    // Tilt to 3CRV
<<<<<<< HEAD
    await exchagneMethod(1, 0, liquidityDiff, 0);
  } else if (crv3Value.gt(mainCoinValue)) {
    const diffInDollars = crv3Value.sub(mainCoinValue);
    const liquidityDiff = await get3CRVLiquidity(fixture, diffInDollars.div(2));

    // Tilt to Main Token
    await exchagneMethod(0, 1, liquidityDiff, 0);
=======
    await exchangeMethod(1, 0, liquidityDiff, 0);
  } else if (crv3Value.gt(mainCoinValue)) {
    const diffInDollars = crv3Value.sub(mainCoinValue);
    const liquidityDiff = await get3CRVLiquidity(fixture, diffInDollars.div(2));
    // Tilt to Main Token
    await exchangeMethod(0, 1, liquidityDiff, 0);
>>>>>>> origin/master
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
async function tiltTo3CRV_Metapool_automatic(fixture) {
  const { metapool, threePoolToken } = fixture;

<<<<<<< HEAD
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [metapool.address],
  });

  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [metapool.address, "0x1bc16d674ec8000000"],
  });

  const metapoolSigner = await ethers.provider.getSigner(metapool.address);
=======
  const metapoolSigner = await impersonateAndFundContract(metapool.address);
>>>>>>> origin/master
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

<<<<<<< HEAD
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [metapool.address],
  });

  await hre.network.provider.request({
    method: "hardhat_setBalance",
    params: [metapool.address, "0x1bc16d674ec8000000"],
  });

  const metapoolSigner = await ethers.provider.getSigner(metapool.address);
=======
  const metapoolSigner = await impersonateAndFundContract(metapool.address);
>>>>>>> origin/master
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
<<<<<<< HEAD
  const { vault, domen } = fixture;
=======
  const { vault, domen, ousdMetaPool } = fixture;
>>>>>>> origin/master

  // Balance metapool
  await _balanceMetaPool(fixture, metapool);

  amount = amount || ousdUnits("1000000");

  // Tilt to 3CRV by a million
  const exchangeSign = "exchange(int128,int128,uint256,uint256)";
<<<<<<< HEAD
  await metapool.connect(domen)[exchangeSign](1, 0, amount.div(2), 0);
=======
  // make metapool make exchange on itself. It should always have enough OUSD/3crv to do this
  const metapoolSigner = await impersonateAndFundContract(ousdMetaPool.address);

  await metapool.connect(metapoolSigner)[exchangeSign](1, 0, amount.div(2), 0);
>>>>>>> origin/master

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
<<<<<<< HEAD
  await ousdMetaPool.connect(domen)[exchangeSign](0, 1, amount.div(2), 0);
=======
  // make metapool make exchange on itself. It should always have enough OUSD/3crv to do this
  const metapoolSigner = await impersonateAndFundContract(ousdMetaPool.address);

  await ousdMetaPool
    .connect(metapoolSigner)
    // eslint-disable-next-line
    [exchangeSign](0, 1, amount.div(2), 0);
>>>>>>> origin/master

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
