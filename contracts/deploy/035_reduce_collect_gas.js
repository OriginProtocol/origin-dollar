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
    // Current contracts
    const cCompStratProxy = await ethers.getContract("CompoundStrategyProxy");

    // Deploy new compound strategy implementation
    const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");

    // Governance Actions
    // ----------------
    return {
      name: "Reduce COMP rewards gas cost",
      actions: [
        // 1. Compound Strategy use new implementation
        {
          contract: cCompStratProxy,
          signature: "upgradeTo(address)",
          args: [dCompoundStrategy.address],
        },
      ],
    };
  }
);
