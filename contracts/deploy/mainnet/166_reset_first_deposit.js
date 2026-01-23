const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "166_reset_first_deposit",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    // Current contracts
    const cStakingStrategyProxy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );
    const cStakingStrategy = await ethers.getContractAt(
      "CompoundingStakingSSVStrategy",
      cStakingStrategyProxy.address
    );

    return {
      name: `Allow the initial 1 ETH validator deposits to be made two at a time.`,
      actions: [
        {
          contract: cStakingStrategy,
          signature: "resetFirstDeposit()",
          args: [],
        },
      ],
    };
  }
);
