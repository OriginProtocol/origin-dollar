//
// Deploy new Liquidity Reward contract
//
const {
  getAssetAddresses,
  isMainnet,
  isRinkeby,
  isFork,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const addresses = require("../utils/addresses.js");
const { utils } = require("ethers");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
} = require("../utils/deploy");

const deployName = "020_uniswapv3_ousd_usdt";

const uniswapv3 = async ({ getNamedAccounts, deployments }) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr, deployerAddr } = await getNamedAccounts();

  const assetAddresses = await getAssetAddresses(deployments);



  console.log(`${deployName} deployment done.`);
  return true;
};

uniswapv3.id = deployName;
uniswapv3.dependencies = ["core"];

// Liquidity mining will get deployed to Rinkeby and Mainnet at a later date.
uniswapv3.skip = () => isMainnet || isRinkeby || isFork;

module.exports = uniswapv3;
