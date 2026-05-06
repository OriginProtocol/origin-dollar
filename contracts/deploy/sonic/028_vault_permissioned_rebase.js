const { deployOnSonic } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

const ONE_DAY = 24 * 60 * 60;

module.exports = deployOnSonic(
  {
    deployName: "028_vault_permissioned_rebase",
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
      name: "Upgrade OSonicVault for permissioned + throttled rebase",
      actions: [
        {
          contract: cOSonicVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOSonicVault.address],
        },
        {
          contract: cOSonicVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.sonic.guardian],
        },
        {
          contract: cOSonicVault,
          signature: "setMinRebaseInterval(uint256)",
          args: [ONE_DAY],
        },
      ],
    };
  }
);
