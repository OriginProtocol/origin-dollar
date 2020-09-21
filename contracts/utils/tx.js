// Ethereum transaction related utilities
const ethers = require('ethers')


/**
 * Calculates an above average gas price.
 * Can be used to submit a transaction for faster than average mining time.
 *
 * @param {Number} extra: Percentage to apply on top of the current gas price.
 * @returns {Promise<BigNumber>}
 */
async function premiumGasPrice(extra=10) {
  const gasPriceMultiplier = ethers.BigNumber.from(100 + Number(extra))
  const gasPriceDivider = ethers.BigNumber.from(100)

  if (gasPriceMultiplier.lt(0) || gasPriceMultiplier.gt(130)) {
    throw new Error(`premiumGasPrice called with extra out of range`)
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
 * See https://buidler.dev/plugins/buidler-deploy.html for available options.
 *
 * @returns {Promise<{gasPrice: *}|{}>}
 */
async function getTxOpts() {
  if (process.env.PREMIUM_GAS) {
    const gasPrice = await premiumGasPrice(process.env.PREMIUM_GAS);
    return { gasPrice };
  }
  return {};
}

exports.module = {
  getTxOpts,
  premiumGasPrice,
}