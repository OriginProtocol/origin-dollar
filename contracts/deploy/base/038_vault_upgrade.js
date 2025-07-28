const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "038_vault_upgrade",
    //proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // Deploy new implementation without storage slot checks because of the:
    // - Renamed `dripper` to `_deprecated_dripper`
    const dOETHbVaultCore = await deployWithConfirmation(
      "OETHBaseVaultCore",
      [addresses.base.WETH],
      "OETHBaseVaultCore",
      true
    );

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Upgrade VaultCore",
      actions: [
        // 1. Upgrade VaultCore implementation
        {
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVaultCore.address],
        },
      ],
    };
  }
);
