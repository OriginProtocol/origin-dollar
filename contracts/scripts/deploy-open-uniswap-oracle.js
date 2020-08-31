const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;

// USDCEth Uniswap Pair
USDCETHPair = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc";

// Open Oracle reference
OpenOracle = "0x9b8eb8b3d6e2e0db36f41455185fef7049a35cae";

// WETH Token... placeholder for ETH
ETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";


async function main() {
  const OUOracle = await ethers.getContractFactory("OpenUniswapOracle");
  const ouoracle = await OUOracle.deploy(OpenOracle, ETH);
  await ouoracle.deployed();

  console.log("Open Uniswap Oracle deployed. Address:", ouoracle.address);

  await ouoracle.registerPair(USDCETHPair);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
