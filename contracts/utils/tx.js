// Ethereum transaction related utilities
const ethers = require("ethers");

/**
 * Calculates an above average gas price.
 * Can be used to submit a transaction for faster than average mining time.
 *
 * @param {Number} mutliplier: Multiplier applied to the current gas price. For ex 1.15 gives an extra 15%.
 * @returns {Promise<BigNumber>}
 */
async function premiumGasPrice(multiplier) {
  const gasPriceMultiplier = ethers.BigNumber.from(
    Math.floor(100 * Number(multiplier))
  );
  const gasPriceDivider = ethers.BigNumber.from(100);

  if (gasPriceMultiplier.lt(100) || gasPriceMultiplier.gt(200)) {
    throw new Error(`premiumGasPrice called with multiplier out of range`);
  }

  // Get current gas price from the network.
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.PROVIDER_URL
  );
  const gasPrice = await provider.getGasPrice();

  const premiumGasPrice = gasPrice.mul(gasPriceMultiplier).div(gasPriceDivider);

  if (process.env.VERBOSE) {
    console.log(
      `Gas price (gwei): Regular=${ethers.utils.formatUnits(
        gasPrice,
        "gwei"
      )} Premium=${ethers.utils.formatUnits(premiumGasPrice, "gwei")}`
    );
  }

  return premiumGasPrice;
}

/**
 * Returns extra options to use when sending a tx to the network.
 * @param {Number} gasLimit: Optional gas limit to set.
 * @returns {Promise<void>}
 */
async function getTxOpts(gasLimit = null) {
  let txOpts = {};
  if (gasLimit) {
    txOpts.gasLimit = gasLimit;
  }
  if (process.env.GAS_PRICE_MULTIPLIER) {
    const gasPrice = await premiumGasPrice(process.env.GAS_PRICE_MULTIPLIER);
    txOpts.gasPrice = gasPrice;
  }
  return txOpts;
}

module.exports = {
  getTxOpts,
  premiumGasPrice,
};
