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
  const vuniswapOracle = await ethers.getContractAt("IViewEthUsdOracle", uniswapOracleAddress)
  const vchainlinkOracle = await ethers.getContractAt("IViewEthUsdOracle", chainlinkOracleAddress)
  const pokeMixOracle = await ethers.getContractAt("MixOracle", mixOracleAddress)
  const mixOracle = await ethers.getContractAt("IViewMinMaxOracle", mixOracleAddress)

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

    if (symbol == 'ETH') {
     try {
        uniswapPrice = await vuniswapOracle.ethUsdPrice()
        console.log(uniswapPrice.toString(), "(Uniswap)")
      } catch(e) {
        console.log('Failed fetching price from Uniswap oracle')
      }

      // 2. Get price from chainlink.
      let chainlinkPrice
      try {
        chainlinkPrice = await vchainlinkOracle.ethUsdPrice()
        console.log(chainlinkPrice.toString(), "(Chainlink)")
      } catch(e) {
        console.log('Failed fetching price from chainlink oracle')
      }
    } else {
      try {
        uniswapPrice = await vuniswapOracle.tokEthPrice(symbol)
        console.log(uniswapPrice.toString(), "(Uniswap ETH)")
      } catch(e) {
        console.log('Failed fetching price from Uniswap oracle')
      }

      // 2. Get price from chainlink.
      let chainlinkPrice
      try {
        chainlinkPrice = await vchainlinkOracle.tokEthPrice(symbol)
        console.log(chainlinkPrice.toString(), "(Chainlink ETH)")
      } catch(e) {
        console.log('Failed fetching price from chainlink oracle')
      }

      // 3. Get price from mix.
      try {
        //actually update the window
        await pokeMixOracle.priceMin(symbol);
        const min = await mixOracle.priceMin(symbol);
        const max = await mixOracle.priceMax(symbol);
        console.log(min.toString(), "(Mix min)")
        console.log(max.toString(), "(Mix max)")
      } catch(e) {
        console.log('Failed fetching price from mix oracle', e)
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
