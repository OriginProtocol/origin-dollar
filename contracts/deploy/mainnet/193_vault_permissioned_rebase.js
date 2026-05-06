const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const ONE_DAY = 24 * 60 * 60;

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
      name: "Upgrade OUSD and OETH vaults with permissioned + throttled rebase",
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
          contract: cOUSDVault,
          signature: "setMinRebaseInterval(uint256)",
          args: [ONE_DAY],
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
        {
          contract: cOETHVault,
          signature: "setMinRebaseInterval(uint256)",
          args: [ONE_DAY],
        },
      ],
    };
  }
);
