const hre = require("hardhat");
const ethers = hre.ethers;

// IMPORTANT NOTE: before running this script, make sure to run
// the "deploy-mix-oracles.js" scripts to populate oracleAddresses.json.
let oracleAddresses;
try {
  oracleAddresses = require("./oracleAddresses.json");
} catch {
  throw new Error(
    "Missing oracleAddresses.json file. Make sure to run the deploy-mix-oracles.js script first"
  );
}

const uniswapOracleAddress = oracleAddresses.OpenUniswap;
const chainlinkOracleAddress = oracleAddresses.Chainlink;
const mixOracleAddress = oracleAddresses.Mix;

if (!uniswapOracleAddress || !chainlinkOracleAddress || !mixOracleAddress) {
  throw new Error(
    "Missing address(es) in oracleAddresses.json. Re-run the deploy-mix-oracles.js script."
  );
}

async function main() {
  // Get contracts.
  const uniswapOracle = await ethers.getContractAt(
    "IViewEthUsdOracle",
    uniswapOracleAddress
  );
  const chainlinkOracle = await ethers.getContractAt(
    "IViewEthUsdOracle",
    chainlinkOracleAddress
  );
  //make all the prices callable!
  const mixOracle = await ethers.getContractAt(
    "IViewMinMaxOracle",
    mixOracleAddress
  );

  // get all eth Prices first

  console.log(
    "Uniswap   eth price:",
    (await uniswapOracle.ethUsdPrice()).toString()
  );
  console.log(
    "Chainlink eth price:",
    (await chainlinkOracle.ethUsdPrice()).toString()
  );
  const [ethMin, ethMax] = await mixOracle.priceEthMinMax();
  console.log("Mix       eth   Min:", ethMin.toString());
  console.log("Mix       eth   Max:", ethMax.toString());

  const symbols = ["DAI", "USDT", "USDC"];
  for (const symbol of symbols) {
    console.log(`===== ${symbol} =====`);

    // 1. Get price from uniswap and open price
    let openPrice, uniswapPrice;
    try {
      uniswapPrice = await uniswapOracle.tokEthPrice(symbol);
      console.log(uniswapPrice.toString(), "(Uniswap)");
    } catch (e) {
      console.log("Failed fetching price from Uniswap oracle", e);
    }

    // 2. Get price from chainlink.
    let chainlinkPrice;
    try {
      chainlinkPrice = await chainlinkOracle.tokEthPrice(symbol);
      console.log(chainlinkPrice.toString(), "(Chainlink)");
    } catch (e) {
      console.log("Failed fetching price from chainlink oracle", e);
      return;
    }

    // 3. Get price from mix.
    let min, max;
    try {
      [min, max] = await mixOracle.priceTokEthMinMax(symbol);
      console.log(min.toString(), "(Mix min)");
      console.log(max.toString(), "(Mix max)");
    } catch (e) {
      console.log("Failed fetching price from mix oracle", e);
    }

    // 4. Get tok->usd price from mix.
    try {
      console.log(min.mul(ethMin).div("1000000").toString(), "(USD min)");
      console.log(max.mul(ethMax).div("1000000").toString(), "(USD max)");
    } catch (e) {
      console.log("Failed fetching price from mix oracle", e);
      return;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
