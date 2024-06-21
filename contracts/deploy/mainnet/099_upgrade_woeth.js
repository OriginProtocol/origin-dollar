const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "099_upgrade_woeth",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
  },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const cOETHProxy = await ethers.getContract("OETHProxy");
    const cWOETHProxy = await ethers.getContract("WOETHProxy");

    const dWOETHImpl = await deployWithConfirmation("WOETH", [
      cOETHProxy.address,
      "Wrapped OETH",
      "WOETH",
    ]);

    // Governance Actions
    // ----------------
    return {
      name: `Upgrade WOETH to a new implementation.`,
      actions: [
        // 1. Upgrade WOETH
        {
          contract: cWOETHProxy,
          signature: "upgradeTo(address)",
          args: [dWOETHImpl.address],
        },
      ],
    };
  }
);
