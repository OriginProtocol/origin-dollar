//
// Deploys a new governor contract on Mainnet
//

const { isMainnet, isRinkeby, isFork } = require("../test/helpers.js");
const { deployWithConfirmation } = require("../utils/deploy");

const deployName = "003_governor";

const deployNewGovernor = async ({ getNamedAccounts }) => {
  console.log(`Running ${deployName} deployment...`);
  const { guardianAddr } = await getNamedAccounts();

  // Deploy a new governor contract.
  // The governor's admin is the guardian account (e.g. the multi-sig).
  // Set a min delay of 60sec for executing proposals.
  await deployWithConfirmation("Governor", [guardianAddr, 60]);

  console.log(`${deployName} deploy done.`);
  return true;
};

deployNewGovernor.id = deployName;
deployNewGovernor.dependencies = ["core"];

// Only run on non-local network.
deployNewGovernor.skip = () => !(isMainnet || isRinkeby) || isFork;

module.exports = deployNewGovernor;
