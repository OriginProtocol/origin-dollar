const addresses = require("../utils/addresses");
const {
  isMainnet,
  isRinkeby,
  getAssetAddresses,
} = require("../test/helpers.js");
const { getTxOpts } = require("../utils/tx");

let totalDeployGasUsed = 0;

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

function log(msg, deployResult = null) {
  if (isMainnet || isRinkeby || process.env.VERBOSE) {
    if (deployResult && deployResult.receipt) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      totalDeployGasUsed += gasUsed;
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

const threePoolStrategiesDeploy = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  log("Running 12_three_pool_strategies deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const assetAddresses = await getAssetAddresses(deployments);

  // Deploy a new Compound strategy
  const dCompoundStrategy = await deploy("CompoundStrategy", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCompoundStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed Compound strategy", dCompoundStrategy);

  const dCompoundStrategyProxy = await deploy("CompoundStrategyProxy", {
    from: deployerAddr,
  });
  await ethers.provider.waitForTransaction(
    dCompoundStrategyProxy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CompoundStrategyProxy", dCompoundStrategyProxy);

  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    dCompoundStrategyProxy.address
  );

  const cVaultProxy = await ethers.getContract("VaultProxy");

  transaction = await cCompoundStrategy
    .connect(sDeployer)
    .initialize(
      addresses.dead,
      cVaultProxy.address,
      assetAddresses.COMP,
      [assetAddresses.DAI],
      [assetAddresses.cDAI],
      await getTxOpts()
    );
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Initialized CompoundStrategy");

  // Governor was set to the deployer address during deployment of Compound strategy
  // Update it to the governor address.
  transaction = await cCompoundStrategy
    .connect(sDeployer)
    .transferGovernance(governorAddr, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("CompoundStrategy transferGovernance called");
};

threePoolStrategiesDeploy.dependencies = ["core"];

module.exports = threePoolStrategiesDeploy;
