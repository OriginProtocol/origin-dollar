const { isFork } = require("../test/helpers");
const { deployWithConfirmation } = require("../utils/deploy");

const deployName = "085_deploy_l2_governance_proxies";

const main = async (hre) => {
  console.log(`Running ${deployName} deployment on ${hre.network.name}...`);

  if (hre.network.name == "arbitrumOne") {
    // Deploy L2 Governor on Arbitrum One
    const l2GovernanceProxy = await deployWithConfirmation("L2GovernanceProxy");
    console.log("L2GovernanceProxy address:", l2GovernanceProxy.address);
  } else if (hre.network.name == "mainnet") {
    // Deploy Governance Executor on Mainnet
    const mainnetGovernanceExecutorProxy = await deployWithConfirmation(
      "MainnetGovernanceExecutorProxy"
    );
    console.log(
      "MainnetGovernanceExecutorProxy address:",
      mainnetGovernanceExecutorProxy.address
    );
  }

  console.log(`${deployName} deploy done.`);
};

main.id = deployName;
main.skip = !(isFork || ["arbitrumOne", "mainnet"].includes(hre.network.name));
main.tags = ["arbitrum", "mainnet"];

module.exports = main;
