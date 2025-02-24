const { deployOnBase } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "019_async_withdrawals",
  },
  async ({ ethers }) => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    // Deploy new implementation
    const dOETHbVaultCore = await deployWithConfirmation("OETHBaseVaultCore", [
      addresses.base.WETH,
    ]);
    const dOETHbVaultAdmin = await deployWithConfirmation("OETHBaseVaultAdmin");

    return {
      actions: [
        {
          // 1. Upgrade VaultCore
          contract: cOETHbVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHbVaultCore.address],
        },
        {
          // 2. Upgrade VaultAdmin
          contract: cOETHbVault,
          signature: "setAdminImpl(address)",
          args: [dOETHbVaultAdmin.address],
        },
        {
          // 3. Set async claim delay to 1 day
          contract: cOETHbVault,
          signature: "setWithdrawalClaimDelay(uint256)",
          args: [24 * 60 * 60], // 1d
        },
      ],
    };
  }
);
