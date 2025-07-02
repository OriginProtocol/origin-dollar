const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "145_deploy_xogn_rewards_module",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    await deployWithConfirmation("CollectXOGNRewardsModule", [
      addresses.mainnet.Guardian,
      // Defender Relayer
      "0x4b91827516f79d6F6a1F292eD99671663b09169a",
    ]);
    const cCollectXOGNRewardsModule = await ethers.getContract(
      "CollectXOGNRewardsModule"
    );

    console.log(
      "CollectXOGNRewardsModule deployed to",
      cCollectXOGNRewardsModule.address
    );

    return {
      actions: [],
    };
  }
);
