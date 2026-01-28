const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "167_change_rewards_source_strategist",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    // Current contracts
    const xOGNRewardsSource = await ethers.getContractAt(
      ["function setStrategistAddr(address) external"],
      addresses.mainnet.OGNRewardsSource
    );

    // Governance Actions
    // ----------------
    return {
      name: `Change Guardian address on the OGNRewardsSource contract

We previously changed the Guardian on all Ethereum contracts to the new Multichain Guardian. This contract was missed out. This proposal addresses that so that we can deprecate the older Guardian multisig.`,
      actions: [
        {
          contract: xOGNRewardsSource,
          signature: "setStrategistAddr(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
