const { deployOnHyperEVM } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

// Re-point the HyperEVM CrossChainRemoteStrategy operator to the new Talos KMS
// signer (from the old relayer 0xC79A…0517). setOperator is onlyGovernor and the
// strategy's governor is the HyperEVM Timelock, so this is executed via that
// timelock (scheduled/executed by the hyperevm 5/8 admin). deployOnHyperEVM
// writes the schedule + execute Safe Transaction Builder JSON for the 5/8 admin.
module.exports = deployOnHyperEVM(
  {
    deployName: "003_migrate_crosschain_strategy_to_talos",
  },
  async () => {
    const cCrossChainRemoteStrategy = await ethers.getContractAt(
      "CrossChainRemoteStrategy",
      addresses.hyperevm.CrossChainRemoteStrategy
    );

    return {
      name: "Migrate the HyperEVM CrossChainRemoteStrategy operator to the new Talos signer.",
      actions: [
        {
          contract: cCrossChainRemoteStrategy,
          signature: "setOperator(address)",
          args: [addresses.talosRelayer],
        },
      ],
    };
  }
);
