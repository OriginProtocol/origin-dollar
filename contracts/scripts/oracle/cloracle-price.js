const hre = require("@nomiclabs/hardhat");
const ethers = hre.ethers;
const e = require("ethers");

async function main() {
  const oracle = await ethers.getContractAt("ChainlinkOracle", process.argv[2]);
  const symbol = process.argv[3];

  console.log("price:", e.utils.formatEther(await oracle.price(symbol)));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
