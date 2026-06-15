const { deployOnBase } = require("../../utils/deploy-l2");

// Unpause rebases on the OETHb (Base) vault. `unpauseRebase()` is
// onlyGovernorOrStrategist; here it is executed by the Base Timelock (the
// governor), scheduled and executed by the Base 5/8 admin Safe via the standard
// deployOnBase timelock flow. Idempotent — it only sets rebasePaused = false.
//
// Note: 051_migrate_base_operators_to_talos already bundles this same
// unpauseRebase() with the operator migration; this file unpauses independently
// of that migration.
module.exports = deployOnBase(
  {
    deployName: "055_unpause_oethb_rebase",
  },
  async () => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    return {
      name: "Unpause rebases on the OETHb (Base) vault",
      actions: [
        {
          contract: cOETHbVault,
          signature: "unpauseRebase()",
          args: [],
        },
      ],
    };
  }
);
