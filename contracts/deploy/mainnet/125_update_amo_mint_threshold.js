const { oethUnits } = require("../../test/helpers");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "125_update_amo_mint_threshold",
    forceDeploy: false,
    reduceQueueTime: true,
    // proposalId:
  },
  async () => {
    // Reference the OETH Vault
    const cOETHVault = await resolveContract("OETHVaultProxy", "IVault");

    return {
      name: "Update OETH Curve AMO mint threshold",
      actions: [
        {
          contract: cOETHVault,
          signature: "setNetOusdMintForStrategyThreshold(uint256)",
          args: [oethUnits("50000")],
        },
      ],
    };
  }
);
