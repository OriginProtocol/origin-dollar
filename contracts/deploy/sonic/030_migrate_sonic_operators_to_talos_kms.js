const addresses = require("../../utils/addresses");
const { deployOnSonic } = require("../../utils/deploy-l2");

// Migrate the Sonic operator/registrator roles from the old relayer EOA to the
// new Talos KMS signer. All three actions are governor-gated and executed via
// the Sonic Timelock (scheduled by the Sonic 5/8 admin). The vault rebase is
// operator-gated and currently paused, so we also unpause it once the operator
// is set.
module.exports = deployOnSonic(
  {
    deployName: "030_migrate_sonic_operators_to_talos",
  },
  async ({ ethers }) => {
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    const cSonicStakingStrategyProxy = await ethers.getContract(
      "SonicStakingStrategyProxy"
    );
    const cSonicStakingStrategy = await ethers.getContractAt(
      "SonicStakingStrategy",
      cSonicStakingStrategyProxy.address
    );

    return {
      name: "Migrate Sonic operators to the Talos KMS signer",
      actions: [
        {
          contract: cOSonicVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.talosRelayer],
        },
        {
          contract: cOSonicVault,
          signature: "unpauseRebase()",
          args: [],
        },
        {
          contract: cSonicStakingStrategy,
          signature: "setRegistrator(address)",
          args: [addresses.talosRelayer],
        },
      ],
    };
  }
);
