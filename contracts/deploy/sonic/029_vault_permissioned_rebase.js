const { deployOnSonic } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "029_vault_permissioned_rebase",
  },
  async ({ ethers }) => {
    // 1. Deploy new OSVault implementation
    const dOSonicVault = await deployWithConfirmation(
      "OSVault",
      [addresses.sonic.wS],
      "OSVault",
      true
    );

    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVault = await ethers.getContractAt(
      "IVault",
      cOSonicVaultProxy.address
    );

    return {
      name: "Upgrade OSonicVault: permissioned rebase, drop auto-rebase triggers",
      actions: [
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVault.address],
        },
        {
          contract: cOSonicVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.talosRelayer],
        },
      ],
    };
  }
);
