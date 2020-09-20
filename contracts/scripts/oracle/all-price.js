// Script for getting current oracle prices.
// See README for usage.

const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;

const { formatUnits } = require("ethers").utils;

function loadJson(filename) {
  try {
    return require(filename);
  } catch (e) {
    throw new Error(`Missing file ${filename}`);
  }
}

function loadOracleAddresses() {
  let addresses;

  const isGanacheFork = bre.network.name === "ganache" && process.env.FORK;
  const isMainnet = bre.network.name === "mainnet";

  if (isGanacheFork || isMainnet) {
    const deploymentPath = isGanacheFork
      ? "../../deployments/ganache_1337"
      : "../../deployments/mainnet";

    // If we are running a ganache fork or mainnet, get the contract addresses from the deployment files.
    console.log(
      `Reading oracle addresses from buidler deployment at ${deploymentPath}`
    );

    const mixOracleABI = loadJson(`${deploymentPath}/MixOracle.json`);
    const chainlinkOraclelABI = loadJson(
      `${deploymentPath}/ChainlinkOracle.json`
    );
    const uniswapOracleABI = loadJson(
      `${deploymentPath}/OpenUniswapOracle.json`
    );

    addresses = {
      OpenUniswap: uniswapOracleABI.address,
      Chainlink: chainlinkOraclelABI.address,
      Mix: mixOracleABI.address,
    };
  } else {
    // Get the contract addresses from the local config file.
    console.log("Reading oracle addresses from oracleAddresses.json");
    addresses = loadJson("./oracleAddresses.json");
  }

  console.log("Oracle addresses:");
  console.log(JSON.stringify(addresses, null, 2));

  if (!addresses.OpenUniswap || !addresses.Chainlink || !addresses.Mix) {
    throw new Error(
      "Missing address(es) in oracleAddresses.json. Re-run the deploy-mix-oracles.js script."
    );
  }

  return addresses;
}

async function main() {
  const oracleAddresses = loadOracleAddresses();
  const uniswapOracleAddress = oracleAddresses.OpenUniswap;
  const chainlinkOracleAddress = oracleAddresses.Chainlink;
  const mixOracleAddress = oracleAddresses.Mix;

  // Get contracts.
  const uniswapOracle = await ethers.getContractAt(
    "OpenUniswapOracle",
    uniswapOracleAddress
  );
  const vuniswapOracle = await ethers.getContractAt(
    "IViewEthUsdOracle",
    uniswapOracleAddress
  );
  const vchainlinkOracle = await ethers.getContractAt(
    "IViewEthUsdOracle",
    chainlinkOracleAddress
  );
  const pokeMixOracle = await ethers.getContractAt(
    "MixOracle",
    mixOracleAddress
  );
  const mixOracle = await ethers.getContractAt(
    "IViewMinMaxOracle",
    mixOracleAddress
  );

  const symbols = ["ETH", "DAI", "USDT", "USDC"];
  for (const symbol of symbols) {
    console.log(`===== ${symbol} =====`);

    // 1. Get price from uniswap and open price
    let openPrice, uniswapPrice;
    try {
      openPrice = await uniswapOracle.openPrice(symbol);
      console.log(formatUnits(openPrice, 6).toString(), "USD (Open)");
    } catch (e) {
      console.log("Failed fetching price from open feed oracle");
    }

    if (symbol == "ETH") {
      try {
        uniswapPrice = await vuniswapOracle.ethUsdPrice();
        console.log(formatUnits(uniswapPrice, 6).toString(), "USD (Uniswap)");
      } catch (e) {
        console.log("Failed fetching price from Uniswap oracle");
      }

      // 2. Get price from chainlink.
      let chainlinkPrice;
      try {
        chainlinkPrice = await vchainlinkOracle.ethUsdPrice();
        console.log(
          formatUnits(chainlinkPrice, 6).toString(),
          "USD (Chainlink)"
        );
      } catch (e) {
        console.log("Failed fetching price from chainlink oracle");
      }
    } else {
      try {
        uniswapPrice = await vuniswapOracle.tokEthPrice(symbol);
        console.log(formatUnits(uniswapPrice, 8).toString(), "ETH (Uniswap)");
      } catch (e) {
        console.log("Failed fetching price from Uniswap oracle");
      }

      // 2. Get price from chainlink.
      let chainlinkPrice;
      try {
        chainlinkPrice = await vchainlinkOracle.tokEthPrice(symbol);
        console.log(
          formatUnits(chainlinkPrice, 8).toString(),
          "ETH (Chainlink)"
        );
      } catch (e) {
        console.log("Failed fetching price from chainlink oracle");
      }

      // 3. Get price from mix.
      try {
        if (process.argv[2] == "POKE") {
          // Update the openUniswap oracle window
          await pokeMixOracle.priceMin(symbol);
        }
        const min = await mixOracle.priceMin(symbol);
        const max = await mixOracle.priceMax(symbol);
        console.log(formatUnits(min, 8).toString(), "USD (Mix min)");
        console.log(formatUnits(max, 8).toString(), "USD (Mix max)");
      } catch (e) {
        console.log("Failed fetching price from mix oracle", e);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
