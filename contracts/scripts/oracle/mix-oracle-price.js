const hre = require("hardhat");
const ethers = hre.ethers;
const e = require("ethers");

async function main() {
  const oracle = await ethers.getContractAt("MixOracle", process.argv[2]);
  const symbol = process.argv[3];

  const [min, max] = await oracle.priceMinMax(symbol);
  console.log(
    "prices Min Max:",
    e.utils.formatEther(min),
    e.utils.formatEther(max)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
