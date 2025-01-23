const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "119_set_reward_proceeds_to_fixed_rate_dripper",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cOETHHarvester = await ethers.getContractAt(
      "OETHHarvester",
      cOETHHarvesterProxy.address
    );
    const cOETHFixedRateDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Change RewardProceeds address to FixedRateDripper on OETHHarvester",
      actions: [
        {
          contract: cOETHHarvester,
          signature: "setRewardProceedsAddress(address)",
          args: [cOETHFixedRateDripperProxy.address],
        },
      ],
    };
  }
);
