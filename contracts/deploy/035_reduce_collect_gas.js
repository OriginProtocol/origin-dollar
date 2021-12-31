const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "035_reduce_collect_gas", forceDeploy: false },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cCompStratProxy = await ethers.getContract("CompoundStrategyProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy new compound strategy implementation
    const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");

    // Governance Actions
    // ----------------
    return {
      name: "Reduce COMP collect gas useage by 80%",
      actions: [
        // 1. Value use new implementation
        {
          contract: cCompStratProxy,
          signature: "upgradeTo(address)",
          args: [dCompoundStrategy.address],
        },
      ],
    };
  }
);
