const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "193_vault_permissioned_rebase",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // 1. Deploy new OUSD Vault implementation
    const dOUSDVault = await deployWithConfirmation("OUSDVault", [
      addresses.mainnet.USDC,
    ]);

    // 2. Deploy new OETH Vault implementation
    const dOETHVault = await deployWithConfirmation("OETHVault", [
      addresses.mainnet.WETH,
    ]);

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

    return {
      name: "Upgrade OUSD and OETH vaults: permissioned rebase, drop auto-rebase triggers",
      actions: [
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDVault.address],
        },
        {
          contract: cOUSDVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHVault.address],
        },
        {
          contract: cOETHVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.multichainStrategist],
        },
      ],
    };
  }
);
