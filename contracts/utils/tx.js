// Ethereum transaction related utilities
const ethers = require('ethers')


/**
 * Calculates an above average gas price.
 * Can be used to submit a transaction for faster than average mining time.
 *
 * @param {Number} mutliplier: Multiplier applied to the current gas price. For ex 1.15 gives an extra 15%.
 * @returns {Promise<BigNumber>}
 */
async function premiumGasPrice(multiplier) {
  const gasPriceMultiplier = ethers.BigNumber.from(100 * Number(multiplier))
  const gasPriceDivider = ethers.BigNumber.from(100)

  if (gasPriceMultiplier.lt(100) || gasPriceMultiplier.gt(200)) {
    throw new Error(`premiumGasPrice called with multiplier out of range`)
  }

  // Get current gas price from the network.
  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
  const gasPrice = await provider.getGasPrice()

  const premiumGasPrice = gasPrice
    .mul(gasPriceMultiplier)
    .div(gasPriceDivider)

  if (process.env.VERBOSE) {
    console.log(`Gas price (gwei): Regular=${ethers.utils.formatUnits(gasPrice, "gwei")} Premium=${ethers.utils.formatUnits(premiumGasPrice, "gwei")}`)
  }

  return premiumGasPrice
}


/**
 * Returns extra options to use when sending a tx to the network.
 *
 * @returns {Promise<{gasPrice: ethers.BigNumber}|{}>}
 */
async function getTxOpts() {
  if (process.env.GAS_PRICE_MULTIPLIER) {
    const gasPrice = await premiumGasPrice(process.env.GAS_PRICE_MULTIPLIER);
    return { gasPrice };
  }
  return {};
}

module.exports = {
  getTxOpts,
  premiumGasPrice,
}