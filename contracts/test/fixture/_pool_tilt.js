const hre = require("hardhat");
const { ethers } = hre;
const { BigNumber } = ethers;
const { impersonateAndFundContract, mintWETH } = require("./_fixture");
const addresses = require("../../utils/addresses");

const { ousdUnits } = require("../helpers");

const { factoryCreatePool } = require("./_pools");

const attackerAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

async function getPoolConfiguration(fixture, pool) {
  const { rEthBPT, sfrxETHwstETHrEthBPT } = fixture;

  if (pool.address == rEthBPT?.address) {
    return {
      config: {
        platform: "balancer",
        poolType: "metaStable",
        poolId: await fixture.balancerREthStrategy.balancerPoolId(),
        pool: rEthBPT,
        // important for Balancer type pools order of these must match the Balancer pool
        assetAddressArray: [fixture.reth.address, fixture.weth.address],
        bptToken: rEthBPT,
        balancerVault: fixture.balancerVault,
      },
    };
  } else if (pool.address == sfrxETHwstETHrEthBPT?.address) {
    return {
      config: {
        platform: "balancer",
        poolType: "composableStable",
        poolId: await fixture.balancerSfrxWstRETHStrategy.balancerPoolId(),
        pool: sfrxETHwstETHrEthBPT,
        // important for Balancer type pools order of these must match the Balancer pool
        assetAddressArray: [
          sfrxETHwstETHrEthBPT.address,
          addresses.mainnet.wstETH,
          addresses.mainnet.sfrxETH,
          addresses.mainnet.rETH,
        ],
        bptToken: sfrxETHwstETHrEthBPT,
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
  const attackerEthBalance = await hre.ethers.provider.getBalance(
    attackerAddress
  );
  const assetBalance = await asset.balanceOf(attackerAddress);
  const ethToFund = 1000000;
  const sAttacker = await hre.ethers.provider.getSigner(address);

  if (attackerEthBalance.lte(ousdUnits(`${ethToFund - 100}`))) {
    await impersonateAndFundContract(attackerAddress, `${ethToFund}`); // 1m ETH
  }

  if (assetBalance.lte(assetAmount)) {
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

  return sAttacker;
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
  const pool = await factoryCreatePool(poolConfig.config);

  const tvl = await pool.getTvl();
  const tiltAmount = tvl
    .mul(BigNumber.from(tiltTvlFactor))
    .div(BigNumber.from("100"));

  // fund the attacker
  const sAttacker = await _fundAttackerOption({
    asset: attackAsset,
    // fund with some 20% extra funds
    assetAmount: tiltAmount
      .mul(BigNumber.from("120"))
      .div(BigNumber.from("100")),
    fixture,
  });

  await pool.tiltPool(tiltAmount, attackAsset, sAttacker);

  return {
    sAttacker,
    pool,
  };
}

/* Generic tilt pool function
 *
 */
async function unTiltPool({
  context,
  attackAsset, // asset used to tilt the pool
}) {
  if (!context.pool) {
    throw new Error(
      "Pool variable not set. You should tilt the pool before calling unTilt"
    );
  }

  await context.pool.untiltPool(context.sAttacker, attackAsset);
}

module.exports = {
  tiltPool,
  unTiltPool,
};
