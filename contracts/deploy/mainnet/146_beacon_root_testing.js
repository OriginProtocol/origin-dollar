const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "146_beacon_root_testing",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // 1. Deploy the MockBeaconRoots
    const dMockBeaconRoots = await deployWithConfirmation("MockBeaconRoots");
    console.log(`Deployed MockBeaconRoots ${dMockBeaconRoots.address}`);

    // Governance Actions
    // ----------------
    return {
      name: "",
      actions: [],
    };
  }
);
