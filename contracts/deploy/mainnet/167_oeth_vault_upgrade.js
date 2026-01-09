const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "167_oeth_vault_upgrade",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault Core and Admin implementations
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVaultAdmin",
      [addresses.mainnet.WETH],
      undefined,
      true
    );

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // 3. Connect to the Compounding Staking Strategy Proxy to set it as default strategy
    const defaultStrategy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault to new Core and Admin implementations",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultAdmin.address],
        },
        // 2. Set OETH/WETH AMO as default strategy
        {
          contract: cVault,
          signature: "setDefaultStrategy(address)",
          args: [defaultStrategy.address],
        },
      ],
    };
  }
);
