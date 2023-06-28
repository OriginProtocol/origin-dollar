const { logCurvePool, log } = require("../utils/curve");

const addresses = require("../utils/addresses");
const poolAbi = require("../test/abi/ousdMetapool.json");

/**
 * Prints test accounts.
 */
async function curvePool(taskArguments, hre) {
  // explicitly enable logging
  log.enabled = true;

  const coin0 = taskArguments.pool;
  const coin1 = coin0 === "OETH" ? "ETH " : "USD ";
  const poolAddr =
    coin0 === "OETH"
      ? addresses.mainnet.CurveOETHMetaPool
      : addresses.mainnet.CurveOUSDMetaPool;

  const blockTag = taskArguments.block || "latest";

  const pool = await hre.ethers.getContractAt(poolAbi, poolAddr);
  await logCurvePool(pool, coin0, coin1, blockTag);
}

module.exports = {
  curvePool,
};
