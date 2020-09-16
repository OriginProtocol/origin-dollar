const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;

// USDCEth Uniswap Pair
USDCETHFeed = "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
DAIETHFeed = "0x773616E4d11A78F511299002da57A0a94577F1f4";
USDTETHFeed = "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";

// Open Oracle reference
ETHFeed = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

// WETH Token... placeholder for ETH
ETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

async function main() {
  const CLOracle = await ethers.getContractFactory("ChainlinkOracle");
  const cloracle = await CLOracle.deploy(ETHFeed);
  await cloracle.deployed();

  console.log("Chainlink Oracle deployed. Address:", cloracle.address);

  await cloracle.registerFeed(DAIETHFeed, "DAI", false);
  await cloracle.registerFeed(USDCETHFeed, "USDC", false);
  await cloracle.registerFeed(USDTETHFeed, "USDT", false);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
