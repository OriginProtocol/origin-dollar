const ethers = require('ethers')


// Calculates an above average gas price.
// Can be used to submit a transaction for faster than average mining time.
async function premiumGasPrice() {
  // 10% (1.1 = 110/100) above current gas price.
  const gasPriceMultiplier = ethers.BigNumber.from(110)
  const gasPriceDivider = ethers.BigNumber.from(100)

  // Get current gas price from the network.
  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL)
  const gasPrice = await provider.getGasPrice()
  console.log("Current gas price:", gasPrice.toString())

  const premiumGasPrice = gasPrice
    .mul(gasPriceMultiplier)
    .div(gasPriceDivider)
  console.log("Premium gas price:", premiumGasPrice.toString())

  return premiumGasPrice
}


module.exports = {
  premiumGasPrice
}