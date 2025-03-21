const { oethUnits } = require("../../test/helpers");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { resolveContract } = require("../../utils/resolvers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "126_update_amo_mint_threshold",
    forceDeploy: false,
    reduceQueueTime: true,
    proposalId:
      "30965832335636924298210825232841816133670499253182025520679897537320067618960",
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
