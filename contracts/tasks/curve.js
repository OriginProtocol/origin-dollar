const { logCurvePool, log } = require("../utils/curve");

const addresses = require("../utils/addresses");
const ousdMetapoolAbi = require("../test/abi/ousdMetapool.json");
// const threepoolLPAbi = require("./test/abi/threepoolLP.json");
// const threepoolSwapAbi = require("./test/abi/threepoolSwap.json");

/**
 * Prints test accounts.
 */
async function curvePool(taskArguments, hre) {
  // explicitly enable logging
  log.enabled = true;

  const pool = await hre.ethers.getContractAt(
    ousdMetapoolAbi,
    addresses.mainnet.CurveOETHMetaPool
  );
  await logCurvePool(pool, "OETH", "ETH ");
}

module.exports = {
  curvePool,
};
