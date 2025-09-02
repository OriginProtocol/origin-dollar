const { deployOnSonic } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "025_vault_upgrade",
    //proposalId: "",
  },
  async ({ ethers }) => {
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");

    // Deploy new implementation without storage slot checks because of the:
    // - Renamed `dripper` to `_deprecated_dripper`
    const dOSonicVaultCore = await deployWithConfirmation(
      "OSonicVaultCore",
      [addresses.sonic.wS],
      "OSonicVaultCore",
      true);

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Upgrade VaultCore",
      actions: [
        // 1. Upgrade VaultCore implementation
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVaultCore.address],
        },
      ],
    };
  }
);
