const addresses = require("../utils/addresses");
const { isMainnet, isRinkeby } = require("../test/helpers.js");
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

const upgradeCompound = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 7_compound_upgrade deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy a new vault.
  const dCompoundStrategy = await deploy("CompoundStrategy", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dCompoundStrategy.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed Compound strategy", dCompoundStrategy);

  // Update the proxy to use the new vault.
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  transaction = await cCompoundStrategyProxy
    .connect(sGovernor)
    .upgradeTo(dCompoundStrategy.address);
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Upgraded proxy to use new Compound strategy");

  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );

  // Note no COMP on Rinkeby per https://compound.finance/docs
  transaction = await cCompoundStrategy
    .connect(sGovernor)
    .setRewardTokenAddress(addresses.mainnet.COMP);
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Set reward token address on Compound strategy");

  console.log(
    "7_compound_upgrade deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeCompound.dependencies = ["core"];
upgradeCompound.skip = () => !(isMainnet || isRinkeby);

module.exports = upgradeCompound;
