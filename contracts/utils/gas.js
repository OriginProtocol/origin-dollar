const ethers = require('ethers')


//
//
/**
 * Calculates an above average gas price.
 * Can be used to submit a transaction for faster than average mining time.
 *
 * @param {Number} extra: Percentage to apply on top of the current gas price.
 * @returns {Promise<BigNumber>}
 */
async function premiumGasPrice(extra=10) {
  const gasPriceMultiplier = ethers.BigNumber.from(100 + extra)
  const gasPriceDivider = ethers.BigNumber.from(100)

  // Get current gas price from the network.
  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
  const gasPrice = await provider.getGasPrice()

  const premiumGasPrice = gasPrice
    .mul(gasPriceMultiplier)
    .div(gasPriceDivider)

  return premiumGasPrice
}


module.exports = {
  premiumGasPrice
}