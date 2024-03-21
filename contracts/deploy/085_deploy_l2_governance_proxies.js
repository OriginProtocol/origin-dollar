const { isArbitrumOneOrFork, isMainnetOrFork } = require("../test/helpers");
const { deployWithConfirmation } = require("../utils/deploy");
const { impersonateAndFund } = require("../utils/signers");

const deployName = "085_deploy_l2_governance_proxies";

const main = async (hre) => {
  console.log(`Running ${deployName} deployment on ${hre.network.name}...`);

  const { deployerAddr } = await getNamedAccounts();

  await impersonateAndFund(deployerAddr);

  if (isArbitrumOneOrFork) {
    // Deploy L2 Governor on Arbitrum One
    const l2GovernanceProxy = await deployWithConfirmation("L2GovernanceProxy");
    console.log("L2GovernanceProxy address:", l2GovernanceProxy.address);
  } else if (isMainnetOrFork) {
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
main.skip = !(isArbitrumOneOrFork || isMainnetOrFork);
main.tags = ["arbitrumOne", "mainnet"];

module.exports = main;
