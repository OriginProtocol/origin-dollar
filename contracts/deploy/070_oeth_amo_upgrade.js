const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "070_oeth_amo_upgrade",
    forceDeploy: false,
    deployerIsProposer: true,
  },
  async ({ ethers, deployWithConfirmation }) => {
    const cConvexEthMetaStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );

    const dConvexETHMetaStrategy = await deployWithConfirmation(
      "ConvexEthMetaStrategy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OETH AMO.\n\
      \n\
      Code PR: #",
      actions: [
        // Upgrade the OETH AMO strategy proxy to the new strategy implementation
        {
          contract: cConvexEthMetaStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dConvexETHMetaStrategy.address],
        },
      ],
    };
  }
);
