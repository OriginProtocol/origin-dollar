const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "058_oeth_vault_value_checker" },
  async ({ ethers, deployWithConfirmation }) => {
    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHProxy = await ethers.getContract("OETHProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy new vault value checker
    await deployWithConfirmation(
      "OETHVaultValueChecker",
      [cOETHVaultProxy.address, cOETHProxy.address],
      undefined,
      true // Incompatibable storage layout
    );

    // Governance Actions
    // ----------------
    return {
      name: "VaultValueChecker Deploy",
      actions: [], // No actions
    };
  }
);
