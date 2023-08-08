const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "040_vault_peg_check", forceDeploy: false },
  async ({ deployWithConfirmation }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultCore = await ethers.getContractAt(
      "VaultCore",
      cVaultProxy.address
    );

    // Deployer actions
    // ----------------
    const dVaultCore = await deployWithConfirmation("VaultCore");
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

    // Governance Actions
    // ----------------

    return {
      name: "Vault only mint with pegged stables",
      actions: [
        {
          // Set VaultCore implementation
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        {
          // Set VaultAdmin implementation
          contract: cVaultCore,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
      ],
    };
  }
);
