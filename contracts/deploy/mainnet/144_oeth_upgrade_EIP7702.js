const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "144_oeth_upgrade_EIP7702",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH implementation without storage slot checks
    const dOETH = await deployWithConfirmation("OETH", [], "OETH", true);
    const cOETHProxy = await ethers.getContract("OETHProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH token contract",
      actions: [
        // 1. Upgrade the OETH proxy to the new implementation
        {
          contract: cOETHProxy,
          signature: "upgradeTo(address)",
          args: [dOETH.address],
        },
      ],
    };
  }
);
