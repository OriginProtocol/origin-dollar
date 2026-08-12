const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "055_vault_admin_unpause",
  },
  async ({ ethers }) => {
    // 1. Deploy new OETHBaseVault implementation
    const dOETHbVault = await deployWithConfirmation(
      "OETHBaseVault",
      [addresses.base.WETH],
      "OETHBaseVault",
      true
    );

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    return {
      name: "Upgrade OETHBaseVault: Admin can pause, only Admin can unpause",
      actions: [
        {
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVault.address],
        },
        {
          contract: cOETHbVault,
          signature: "setAdminAddr(address)",
          args: [addresses.base.admin],
        },
      ],
    };
  }
);
