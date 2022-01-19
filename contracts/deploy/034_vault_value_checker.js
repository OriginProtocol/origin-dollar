const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "034_vault_value_checker", forceDeploy: false },
  async ({
    assetAddresses,
    deployWithConfirmation,
    ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy new vault value checker
    const dVaultValueChecker = await deployWithConfirmation(
      "VaultValueChecker",
      [cVaultProxy.address]
    );
    const vaultValueChecker = await ethers.getContract("VaultValueChecker");

    // Governance Actions
    // ----------------
    return {
      name: "VaultValueChecker test",
      actions: [
        // 1. Just to give the governance section something to do
        {
          contract: vaultValueChecker,
          signature: "takeSnapshot()",
          args: [],
        },
      ],
    };
  }
);
