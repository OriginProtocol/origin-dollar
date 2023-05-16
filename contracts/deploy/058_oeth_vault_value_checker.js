const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "058_oeth_vault_value_checker" },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHProxy = await ethers.getContract("OETHProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy new vault value checker
    const dVaultValueChecker = await deployWithConfirmation(
      "OETHVaultValueChecker",
      [cOETHVaultProxy.address, cOETHProxy.address],
      undefined,
      true // Incompatibable storage layout
    );
    const vaultValueChecker = await ethers.getContract("OETHVaultValueChecker");

    // Governance Actions
    // ----------------
    return {
      name: "VaultValueChecker Deploy",
      actions: [], // No actions
    };
  }
);
