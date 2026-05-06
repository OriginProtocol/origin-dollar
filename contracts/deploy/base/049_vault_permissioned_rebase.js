const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

const ONE_DAY = 24 * 60 * 60;

module.exports = deployOnBase(
  {
    deployName: "049_vault_permissioned_rebase",
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
      name: "Upgrade OETHBaseVault for permissioned + throttled rebase",
      actions: [
        {
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVault.address],
        },
        {
          contract: cOETHbVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cOETHbVault,
          signature: "setMinRebaseInterval(uint256)",
          args: [ONE_DAY],
        },
      ],
    };
  }
);
