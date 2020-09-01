const bre = require("@nomiclabs/buidler")
const ethers = bre.ethers
const e = require('ethers')

// IMPORTANT NOTE: before running this script, replace the addresses below with the ones
// the "deploy-mix-oracles.js" scripts outputs.
const uniswapOracleAddress = "0xaB5E7B701B605f74AaC1b749Fd50715f0DEd7Bc5"
const chainlinkOracleAddress = "0xb826CBD8aa01BD3Aa43594A21d5Aa7AD70802f41"
const mixOracleAddress = "0x72D6e9c2be30CF125eF9B3d9DefE241B662b367d"

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
