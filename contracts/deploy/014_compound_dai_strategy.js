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

const compoundDaiStrategyDeploy = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  log("Running 14_compound_dai_strategy deployment...");

  const cMinuteTimelock = await ethers.getContract("MinuteTimelock");

  // On mainnet, the governor is the Timelock contract.
  let strategyGovernorAddress;
  if (isMainnet) {
    strategyGovernorAddress = cMinuteTimelock.address;
  } else {
    strategyGovernorAddress = governorAddr;
  }

  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);
  const assetAddresses = await getAssetAddresses(deployments);

  //
  // Deploy a new Compound strategy and associated proxy
  //
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
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCompoundStrategyProxy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed CompoundStrategyProxy", dCompoundStrategyProxy);

  //
  // Initialize the new Compound strategy and its proxy.
  //
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );
  const cVaultProxy = await ethers.getContract("VaultProxy");

  transaction = await cCompoundStrategyProxy[
    "initialize(address,address,bytes)"
  ](dCompoundStrategy.address, deployerAddr, [], await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Initialized CompoundStrategyProxy");

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

  //
  // Governor was set to the deployer address during the deployment of the strategy.
  // Transfer governance to the governor.
  //
  transaction = await cCompoundStrategy
    .connect(sDeployer)
    .transferGovernance(strategyGovernorAddress, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log(`CompoundStrategy transferGovernance(${strategyGovernorAddress} called`);

  // On Mainnet the governance transfer gets executed separately, via the multi-sig wallet.
  // On other networks, this migration script can handle it.
  if (!isMainnet) {
    transaction = await cCompoundStrategy
      .connect(sGovernor)
      .claimGovernance(await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    log(`Governor at ${governorAddr} Claimed governance on CompoundStrategy`);
  }

  log(
    `14_compound_dai_strategy deploy done. Total gas used for deploys: ${totalDeployGasUsed}`
  );

  return true;
};

compoundDaiStrategyDeploy.dependencies = ["core"];

// On local networks, the strategy and its proxy have already been deployed by migration 001_core
compoundDaiStrategyDeploy.skip = () => !(isMainnet || isRinkeby);

module.exports = compoundDaiStrategyDeploy;
