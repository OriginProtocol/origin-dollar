const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;
const e = require('ethers');

let oracleAddresses
try {
  oracleAddresses = require('./oracleAddresses.json')
} catch {
  throw new Error('Missing oracleAddresses.json file. Make sure to run the deploy-mix-oracles.js script first')
}


async function main() {
  const oracle = await ethers.getContractAt("OpenUniswapOracle", oracleAddresses.OpenUniswap);
  const symbol = process.argv[2];

  const currentBlockNumber = await ethers.provider.getBlockNumber();

  console.log("Block Number is:", currentBlockNumber);

  console.log("Config is:", await oracle.getSwapConfig(symbol));

  if (symbol != "ETH") {
    const [cumPrice, timeDelta, rawPrice, ethPrice] = await oracle.debugPrice(symbol);
    console.log("Debug price:", e.utils.formatEther(cumPrice), timeDelta.toString(), rawPrice.toString(), e.utils.formatEther(ethPrice));
  }
  console.log("Open price:", e.utils.formatEther(await oracle.openPrice(symbol)));
  console.log("price:", e.utils.formatEther(await oracle.price(symbol)));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
