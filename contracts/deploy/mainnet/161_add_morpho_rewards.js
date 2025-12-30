const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "161_add_morpho_rewards",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async () => {
    const cMorphoOUSDv2StrategyProxy = await ethers.getContract(
      "OUSDMorphoV2StrategyProxy"
    );
    const cMorphoOUSDv2Strategy = await ethers.getContractAt(
      "Generalized4626Strategy",
      cMorphoOUSDv2StrategyProxy.address
    );
    // Governance Actions
    // ----------------
    return {
      name: `Add MORPHO as rewards token to Morpho OUSD v2 Strategy`,
      actions: [
        {
          // 1. Add MORPHO as rewards token to Morpho OUSD v2 Strategy
          contract: cMorphoOUSDv2Strategy,
          signature: "setRewardTokenAddresses(address[])",
          args: [[addresses.mainnet.MorphoToken]],
        },
      ],
    };
  }
);
