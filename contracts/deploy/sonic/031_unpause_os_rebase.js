const { deployOnSonic } = require("../../utils/deploy-l2");

// Unpause rebases on the OS (Origin Sonic) vault. `unpauseRebase()` is
// onlyGovernorOrStrategist; here it is executed by the Sonic Timelock (the
// governor), scheduled and executed by the Sonic 5/8 admin Safe via the standard
// deployOnSonic timelock flow. Idempotent — it only sets rebasePaused = false.
//
// Note: 030_migrate_sonic_operators_to_talos already bundles this same
// unpauseRebase() with the operator migration; this file unpauses independently
// of that migration.
module.exports = deployOnSonic(
  {
    deployName: "031_unpause_os_rebase",
  },
  async ({ ethers }) => {
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    return {
      name: "Unpause rebases on the OS (Sonic) vault",
      actions: [
        {
          contract: cOSonicVault,
          signature: "unpauseRebase()",
          args: [],
        },
      ],
    };
  }
);
