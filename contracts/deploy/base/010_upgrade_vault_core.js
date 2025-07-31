const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "010_upgrade_vault_core",
  },
  async ({ ethers }) => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // Deploy new implementation
    const dOETHbVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
      addresses.base.WETH,
    ]);

    return {
      actions: [
        {
          // 1. Upgrade VaultCore
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVaultCore.address],
        },
      ],
    };
  }
);
