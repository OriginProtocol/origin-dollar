const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "115_ousd_upgrade",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "81330106807897532209861932892553497229066239651440694079747414212484833485320",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OUSD implementation without storage slot checks
    const dOUSD = await deployWithConfirmation("OUSD", [], "OUSD", true);
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OUSD token contract",
      actions: [
        // 1. Upgrade the OUSD proxy to the new implementation
        {
          contract: cOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dOUSD.address],
        },
      ],
    };
  }
);
