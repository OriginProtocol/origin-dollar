const { deployOnPlume } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "009_vault_upgrade",
    forceSkip: true,
    //proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");

    // Deploy new implementation without storage slot checks because of the:
    // - Renamed `dripper` to `_deprecated_dripper`
    const dOETHpVaultCore = await deployWithConfirmation(
      "OETHBaseVaultCore",
      [addresses.plume.WETH],
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
          contract: cOETHpVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHpVaultCore.address],
        },
      ],
    };
  }
);
