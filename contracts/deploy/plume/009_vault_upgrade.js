const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "009_vault_upgrade",
    //proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");

    // Deploy new implementation without storage slot checks because of the:
    // - Renamed `dripper` to `_deprecated_dripper`
    const dOETHpVaultCore = await deployWithConfirmation(
      "OETHVaultCore",
      [addresses.mainnet.WETH],
      "OETHVaultCore",
      true
    );

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Upgrade VaultCore",
      actions: [
        // 1. Upgrade Vault proxy to VaultCore
        {
          contract: cOETHpVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHpVaultCore.address],
        }
      ],
    };
  }
);
