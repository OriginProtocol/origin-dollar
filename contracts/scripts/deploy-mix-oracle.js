const bre = require("@nomiclabs/buidler");
const ethers = bre.ethers;
const fs = require('fs')

// USDCEth Uniswap Pair
USDCETHPair = "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc";
DAIETHPair = "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11";
USDTETHPair = "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852";

// Open Oracle reference
OpenOracle = "0x9b8eb8b3d6e2e0db36f41455185fef7049a35cae";

// Chainlink feeds.
USDCETHFeed = "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
DAIETHFeed = "0x773616E4d11A78F511299002da57A0a94577F1f4";
USDTETHFeed = "0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46";

// Chainlink Eth feed
ETHFeed = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

// WETH Token... placeholder for ETH
ETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";


async function main() {
  //
  const OUOracle = await ethers.getContractFactory("OpenUniswapOracle");
  const ouoracle = await OUOracle.deploy(OpenOracle, ETH);
  await ouoracle.deployed();

  console.log("Open Uniswap Oracle deployed. Address:", ouoracle.address);

  await ouoracle.registerPair(USDCETHPair);
  await ouoracle.registerPair(DAIETHPair);
  await ouoracle.registerPair(USDTETHPair);

  const CLOracle = await ethers.getContractFactory("ChainlinkOracle");
  const cloracle = await CLOracle.deploy(ETHFeed);
  await cloracle.deployed();

  console.log("Chainlink Oracle deployed. Address:", cloracle.address);

  await cloracle.registerFeed(DAIETHFeed, "DAI", false);
  await cloracle.registerFeed(USDCETHFeed, "USDC", false);
  await cloracle.registerFeed(USDTETHFeed, "USDT", false);

  const MixOracle = await ethers.getContractFactory("MixOracle");
  const mixoracle = await MixOracle.deploy();
  await mixoracle.deployed();

  console.log("Mix Oracle deployed. Address:", mixoracle.address);

  await mixoracle.registerEthUsdOracle(ouoracle.address);
  await mixoracle.registerEthUsdOracle(cloracle.address);

  await mixoracle.registerTokenOracles("USDC", [ouoracle.address, cloracle.address], [OpenOracle]);
  await mixoracle.registerTokenOracles("USDT", [ouoracle.address, cloracle.address], [OpenOracle]);
  await mixoracle.registerTokenOracles("DAI", [ouoracle.address, cloracle.address], [OpenOracle]);



  await mixoracle.registerTokenOracles("USDC", [ouoracle.address, cloracle.address], [OpenOracle]);
  await mixoracle.registerTokenOracles("USDT", [ouoracle.address, cloracle.address], [OpenOracle]);
  await mixoracle.registerTokenOracles("DAI", [ouoracle.address, cloracle.address], [OpenOracle]);

  const addresses = {
    OpenUniswap: ouoracle.address,
    Chainlink: cloracle.address,
    Mix: mixoracle.address
  }
  fs.writeFileSync('./oracleAddresses.json', JSON.stringify(addresses, null, 2))
  console.log('Saved oracle addresses to oracleAddresses.json')
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
