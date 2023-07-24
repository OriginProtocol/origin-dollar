const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "067_ousd_vault_value_checker" },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy new vault value checker
    const dVaultValueChecker = await deployWithConfirmation(
      "VaultValueChecker",
      [cVaultProxy.address, cOUSDProxy.address],
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
