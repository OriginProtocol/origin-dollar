const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;
const e = require('ethers');

async function main() {
  const oracle = await ethers.getContractAt("OpenUniswapOracle", process.argv[2]);
  const symbol = process.argv[3];

  //console.log("Config is:", await oracle.getSwapConfig(symbol));

  console.log("Open price:", e.utils.formatEther(await oracle.openPrice(symbol)));
  console.log("UnOp price:", e.utils.formatEther(await oracle.price(symbol)));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
