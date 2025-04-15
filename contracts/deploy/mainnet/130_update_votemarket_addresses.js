const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "130_update_votemarket_addresses",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const PoolBooster_OUSD = await ethers.getContractAt(
      "CurvePoolBooster",
      "0x514447A1Ef103f3cF4B0fE92A947F071239f2809"
    );
    const PoolBooster_OETH = await ethers.getContractAt(
      "CurvePoolBooster",
      "0x7B5e7aDEBC2da89912BffE55c86675CeCE59803E"
    );
    return {
      name: "Adjust CampaignRemoteManager and VoteMarket addresses for TriOGN PoolBoosters",
      actions: [
        {
          contract: PoolBooster_OUSD,
          signature: "setCampaignRemoteManager(address)",
          args: [addresses.mainnet.CampaignRemoteManager],
        },
        {
          contract: PoolBooster_OETH,
          signature: "setCampaignRemoteManager(address)",
          args: [addresses.mainnet.CampaignRemoteManager],
        },
        {
          contract: PoolBooster_OUSD,
          signature: "setVotemarket(address)",
          args: [addresses.votemarket],
        },
        {
          contract: PoolBooster_OETH,
          signature: "setVotemarket(address)",
          args: [addresses.votemarket],
        },
      ],
    };
  }
);
