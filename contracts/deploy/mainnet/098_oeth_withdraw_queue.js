const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "098_oeth_withdraw_queue",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
  },
  async ({ deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault Core and Admin implementations
    // Need to override the storage safety check as we are repacking the
    // internal assets mapping to just use 1 storage slot
    const dVaultCore = await deployWithConfirmation(
      "OETHVaultCore",
      [addresses.mainnet.WETH],
      null,
      true
    );
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVaultAdmin",
      [addresses.mainnet.WETH],
      null,
      true
    );

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);
    const cDripperProxy = await ethers.getContract("OETHDripperProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault to support queued withdrawals",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. Set the Dripper contract
        {
          contract: cVault,
          signature: "setDripper(address)",
          args: [cDripperProxy.address],
        },
      ],
    };
  }
);
