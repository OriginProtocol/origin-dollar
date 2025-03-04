const { deployOnSonic } = require("../../utils/deploy-l2");
const { oethUnits } = require("../../test/helpers");
const { resolveContract } = require("../../utils/resolvers");

module.exports = deployOnSonic(
  {
    deployName: "013_vault_config",
  },
  async () => {
    const cOSonicVault = await resolveContract("OSonicVaultProxy", "IVault");

    return {
      actions: [
        {
          // Increase the rebase threshold to 50k wS
          contract: cOSonicVault,
          signature: "setRebaseThreshold(uint256)",
          args: [oethUnits("20000", 18)],
        },
        {
          // Increase the auto-allocation threshold to 20k wS
          contract: cOSonicVault,
          signature: "setAutoAllocateThreshold(uint256)",
          args: [oethUnits("20000", 18)],
        },
        {
          // Reduce the vault buffer to 0.5%
          contract: cOSonicVault,
          signature: "setVaultBuffer(uint256)",
          args: [oethUnits("0.005", 18)],
        },
      ],
    };
  }
);
