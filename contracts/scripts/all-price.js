const bre = require("@nomiclabs/buidler")
const ethers = bre.ethers
const e = require('ethers')

// IMPORTANT NOTE: before running this script, replace the addresses below with the ones
// the "deploy-mix-oracles.js" scripts outputs.
const uniswapOracleAddress = "0x8187283e8EA28Ee03Ad37c55607c2b646dFa8BCb"
const chainlinkOracleAddress = "0x3525ec52f699CeeA4ae3382e4B4CC0ba6E176f98"
const mixOracleAddress = "0x2Dbbf660B4ACd8F5C23dFB01c5E1a4241F8C9E2d"

async function main() {
  // Get contracts.
  const uniswapOracle = await ethers.getContractAt("OpenUniswapOracle", uniswapOracleAddress)
  const chainlinkOracle = await ethers.getContractAt("ChainlinkOracle", chainlinkOracleAddress)
  const mixOracle = await ethers.getContractAt("MixOracle", mixOracleAddress)

  const symbols = ['ETH', 'DAI', 'USDT', 'USDC']
  for (const symbol of symbols) {
    console.log(`===== ${symbol} =====`)

    // 1. Get price from uniswap and open price
    let openPrice, uniswapPrice
    try {
      openPrice = await uniswapOracle.openPrice(symbol)
      console.log(openPrice.toString(), "(Open)")
    } catch(e) {
      console.log('Failed fetching price from open feed oracle')
    }
    try {
      uniswapPrice = await uniswapOracle.price(symbol)
      console.log(uniswapPrice.toString(), "(Uniswap)")
    } catch(e) {
      console.log('Failed fetching price from Uniswap oracle')
    }

    // 2. Get price from chainlink.
    let chainlinkPrice
    try {
      chainlinkPrice = await chainlinkOracle.price(symbol)
      console.log(chainlinkPrice.toString(), "(Chainlink)")
    } catch(e) {
      console.log('Failed fetching price from chainlink oracle')
    }

    // 3. Get price from mix.
    let min, max
    try {
      [min, max] = await mixOracle.priceMinMax(symbol)
      console.log(min.toString(), "(Mix min)")
      console.log(max.toString(), "(Mix max)")
    } catch(e) {
      console.log('Failed fetching price from mix oracle')
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
