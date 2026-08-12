const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "202_vault_admin_unpause",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
  },
  async ({ deployWithConfirmation, ethers }) => {
    // 1. Deploy new OUSD Vault implementation
    const dOUSDVault = await deployWithConfirmation(
      "OUSDVault",
      [addresses.mainnet.USDC],
      undefined,
      true
    );

    // 2. Deploy new OETH Vault implementation
    const dOETHVault = await deployWithConfirmation(
      "OETHVault",
      [addresses.mainnet.WETH],
      undefined,
      true
    );

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDVault = await ethers.getContractAt(
      "IVault",
      cVaultProxy.address
    );

    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    // The Admin (5/8) multisig. Stored in addresses.js as `Guardian`.
    const adminAddr = addresses.mainnet.Guardian;

    return {
      name: "Upgrade OUSD and OETH vaults: Admin can pause, only Admin can unpause",
      actions: [
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDVault.address],
        },
        {
          contract: cOUSDVault,
          signature: "setAdminAddr(address)",
          args: [adminAddr],
        },
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHVault.address],
        },
        {
          contract: cOETHVault,
          signature: "setAdminAddr(address)",
          args: [adminAddr],
        },
      ],
    };
  }
);
