const bre = require("@nomiclabs/buidler")
const ethers = bre.ethers

// IMPORTANT NOTE: before running this script, make sure to run
// the "deploy-mix-oracles.js" scripts to populate oracleAddresses.json.
let oracleAddresses
try {
  oracleAddresses = require('./oracleAddresses.json')
} catch {
  throw new Error('Missing oracleAddresses.json file. Make sure to run the deploy-mix-oracles.js script first')
}

const uniswapOracleAddress = oracleAddresses.OpenUniswap
const chainlinkOracleAddress = oracleAddresses.Chainlink
const mixOracleAddress = oracleAddresses.Mix

if (!uniswapOracleAddress || !chainlinkOracleAddress || !mixOracleAddress) {
  throw new Error('Missing address(es) in oracleAddresses.json. Re-run the deploy-mix-oracles.js script.')
}

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
