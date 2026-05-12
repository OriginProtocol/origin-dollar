const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "194_vault_permissioned_rebase",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "9948092462276445509780797495205471799644905864792185620552351889756709358003",
  },
  async ({ deployWithConfirmation }) => {
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
          args: [addresses.talosRelayer],
        },
        {
          contract: cOETHVaultProxy,
          signature: "upgradeTo(address)",
          args: [dOETHVault.address],
        },
        {
          contract: cOETHVault,
          signature: "setOperatorAddr(address)",
          args: [addresses.talosRelayer],
        },
      ],
    };
  }
);
