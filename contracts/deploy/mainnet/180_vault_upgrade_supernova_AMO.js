const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "180_vault_upgrade_supernova_AMO",
    forceDeploy: false,
    forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "16177445778432224472212272508299557275111595204509579362893638738519171283271",
  },
  async () => {
    return {
      name: "Upgrade OETH Vault to new Core and Admin implementations and deploy Supernova AMO Strategy",
      actions: [],
    };
  }
);
