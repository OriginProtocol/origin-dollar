const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "076_oeth_vault_upgrade",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async ({ ethers, deployWithConfirmation }) => {
    const dVaultCore = await deployWithConfirmation("OETHVaultCore");

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade the OETH Vault with price Oracle.",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
      ],
    };
  }
);
