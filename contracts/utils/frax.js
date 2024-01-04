const { formatUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");
const { impersonateAndFund } = require("./signers");
const { getBlockTimestamp } = require("../test/helpers");
const fraxOracleAbi = require("../test/abi/fraxOracle.json");

const log = require("./logger")("utils:fraxOracle");

/**
 * Sets the Frax Oracle price for frxETH/ETH.
 * Mostly used to set above 0.998 so mints won't revert.
 * @param {BigNumber} price The price with 18 decimals
 */
const setFraxOraclePrice = async (price) => {
  const signer = await impersonateAndFund(
    addresses.mainnet.FrxEthWethDualOracle
  );

  const timestamp = await getBlockTimestamp();

  const fraxOracle = await ethers.getContractAt(
    fraxOracleAbi,
    addresses.mainnet.FrxEthFraxOracle
  );

  log(`About to set frxETH/ETH Oracle price to ${formatUnits(price)}`);
  await fraxOracle.connect(signer).addRoundData(false, price, price, timestamp);
};

module.exports = {
  setFraxOraclePrice,
  log,
};
