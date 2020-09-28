const {
  isMainnet,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
  isGanache,
  getAssetAddresses,
} = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

let totalDeployGasUsed = 0;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

const threePoolStrategy = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 10_vault_split deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  // const assetAddresses = await getAssetAddresses(deployments);

  // Deploy a new vault.
  // await deploy("ThreePoolStrategy", {
  //   from: sGovernor, // TODO: CHANGE
  //   ...(await getTxOpts()),
  // });

  // t = await cCompoundStrategy
  // .connect(sGovernor)
  // .initialize(
  //   addresses.dead,
  //   cVault.address,
  //   assetAddresses.COMP,
  //   tokenAddresses,
  //   [assetAddresses.cDAI, assetAddresses.cUSDC, assetAddresses.cUSDT],
  //   await getTxOpts()
  // );

  return true;
};

threePoolStrategy.dependencies = ["core"];

module.exports = threePoolStrategy;
