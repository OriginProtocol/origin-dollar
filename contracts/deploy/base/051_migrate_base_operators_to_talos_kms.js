const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

// Executed by base.governor 5/8 -> Base Timelock (these setters are onlyGovernor).
// Re-points the Base CrossChainRemoteStrategy operator and the OETHBaseVault
// operatorAddr to the new Talos signer, and unpauses OETHb rebases so Talos can
// rebase the vault directly (operator-gated) — replacing the PermissionedRebaseModule.
module.exports = deployOnBase(
  {
    deployName: "051_migrate_base_operators_to_talos",
  },
  async () => {
    const cCrossChainRemoteStrategy = await ethers.getContractAt(
      "CrossChainRemoteStrategy",
      addresses.base.CrossChainRemoteStrategy
    );

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    return {
      name: "Migrate the Base CrossChainRemoteStrategy operator and OETHBaseVault operatorAddr to the new Talos signer, and unpause OETHb rebases.",
      actions: [
        {
          contract: cCrossChainRemoteStrategy,
          signature: "setOperator(address)",
          args: [addresses.talosRelayer],
        },
        {
          contract: cOETHbVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.talosRelayer],
        },
        {
          contract: cOETHbVault,
          signature: "unpauseRebase()",
          args: [],
        },
      ],
    };
  }
);
