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

const upgradeOusd = async ({ getNamedAccounts, deployments }) => {
  let transaction;

  const { deploy } = deployments;
  const { governorAddr, deployerAddr } = await getNamedAccounts();

  console.log("Running 018_ousd_upgrade deployment...");

  const sGovernor = ethers.provider.getSigner(governorAddr);

  // Deploy a new vault.
  const dOusd = await deploy("OUSD", {
    from: deployerAddr,
    ...(await getTxOpts()),
  });
  await ethers.provider.waitForTransaction(
    dOusd.receipt.transactionHash,
    NUM_CONFIRMATIONS
  );
  log("Deployed OUSD", dOusd);

  // Update the proxy to use the new ousd contract.
  const ousdProxy = await ethers.getContract("OUSDProxy");
  transaction = await ousdProxy
    .connect(sGovernor)
    .upgradeTo(dOusd.address, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  log("Upgraded proxy to use new OUSD contract");

  console.log(
    "018_ousd_upgrade deploy done. Total gas used for deploys:",
    totalDeployGasUsed
  );

  return true;
};

upgradeOusd.dependencies = ["core"];
// upgradeOusd.skip = () => !(isMainnet || isRinkeby);

module.exports = upgradeOusd;
