const hre = require("hardhat");
const { ethers, waffle } = hre;
const { BigNumber } = ethers;
const { impersonateAndFundContract, mintWETH } = require("./_fixture");
const addresses = require("../../utils/addresses");

const { ousdUnits } = require("../helpers");

const { factoryCreatePool } = require("./_pools");

const attackerAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
let sAttacker;
let pool;

async function getPoolConfiguration(fixture, pool) {
  const { rEthBPT } = fixture;

  if (pool.address == rEthBPT.address) {
    return {
      config: {
        platform: "balancer",
        poolType: "metaStablePool",
        poolId: await fixture.balancerREthStrategy.balancerPoolId(),
        pool: rEthBPT,
        // important for Balancer type pools order of these must match the Balancer pool
        assetAddressArray: [fixture.reth.address, fixture.weth.address],
        bptToken: rEthBPT,
        balancerVault: fixture.balancerVault,
      },
    };
  }
}

async function _fundAttackerOption({
  asset, // attacking asset
  assetAmount, // required funded asset amount to perform tilt
  fixture,
}) {
  const attackerEthBalance = await waffle.provider.getBalance(attackerAddress);
  const assetBalance = await asset.balanceOf(attackerAddress);

  if (
    attackerEthBalance.gte(ousdUnits("100000")) ||
    assetBalance.gte(assetAmount)
  ) {
    // attacker sufficiently funded
    return;
  }

  sAttacker = await impersonateAndFundContract(attackerAddress, "1000000"); // 1m ETH

  if (asset.address == fixture.weth.address) {
    await mintWETH(fixture.weth, sAttacker, "500000");
  } else if (asset.address == fixture.sfrxETH.address) {
    const abi = require("../abi/fraxEthMinter.json");
    const minter = await ethers.getContractAt(
      abi,
      addresses.mainnet.FraxETHMinter
    );
    await minter
      .connect(sAttacker)
      .submitAndDeposit(attackerAddress, { value: assetAmount });
  }
}

/* Generic tilt pool function
 *
 */
async function tiltPool({
  fixture,
  /* amount of attacking asset in relation to pool TVL. 100 == 100% of TVL meaning
   * a pool with 1m TVL will get tilted by 1m of attacking asset.
   */
  tiltTvlFactor = 100,
  attackAsset, // asset used to tilt the pool
  poolContract,
}) {
  const poolConfig = await getPoolConfiguration(fixture, poolContract);
  pool = await factoryCreatePool(poolConfig.config);

  const tvl = await pool.getTvl();
  const tiltAmount = tvl
    .mul(BigNumber.from(tiltTvlFactor))
    .div(BigNumber.from("100"));

  // fund the attacker
  await _fundAttackerOption({
    asset: attackAsset,
    // fund with some 20% extra funds
    assetAmount: tiltAmount
      .mul(BigNumber.from("120"))
      .div(BigNumber.from("100")),
    fixture,
  });

  await pool.tiltPool(tiltAmount, attackAsset, sAttacker);
}

/* Generic tilt pool function
 *
 */
async function unTiltPool({
  fixture,
  attackAsset, // asset used to tilt the pool
  poolContract,
}) {
  if (!!pool) {
    throw new Error(
      "Pool variable not set. You should tilt the pool before calling unTilt"
    );
  }

  await pool.untiltPool(sAttacker, attackAsset);
}

/* Withdraw WETH liquidity in Balancer metaStable WETH pool to simulate
 * second part of the MEV attack. All attacker WETH liquidity is withdrawn.
 */
// async function untiltBalancerMetaStableWETHPool({
//   balancerPoolId,
//   assetAddressArray,
//   wethIndex,
//   bptToken,
//   balancerVault,
// }) {
//   const amountsOut = Array(assetAddressArray.length).fill(BigNumber.from("0"));
//
//   /* encode user data for pool joining
//    *
//    * EXACT_BPT_IN_FOR_ONE_TOKEN_OUT:
//    * User sends a precise quantity of BPT, and receives an estimated
//    * but unknown (computed at run time) quantity of a single token
//    *
//    * ['uint256', 'uint256', 'uint256']
//    * [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, exitTokenIndex]
//    */
//   const userData = ethers.utils.defaultAbiCoder.encode(
//     ["uint256", "uint256", "uint256"],
//     [
//       0,
//       await bptToken.balanceOf(sAttacker.address),
//       BigNumber.from(wethIndex.toString()),
//     ]
//   );
//
//   await bptToken
//     .connect(sAttacker)
//     .approve(balancerVault.address, oethUnits("1").mul(oethUnits("1"))); // 1e36
//
//   await balancerVault.connect(sAttacker).exitPool(
//     balancerPoolId, // poolId
//     sAttacker.address, // sender
//     sAttacker.address, // recipient
//     [
//       //ExitPoolRequest
//       assetAddressArray, // assets
//       amountsOut, // minAmountsOut
//       userData, // userData
//       false, // fromInternalBalance
//     ]
//   );
// }

module.exports = {
  tiltPool,
  unTiltPool,
};
