const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "046_vault_value_checker", forceDeploy: false },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy new vault value checker
    await deployWithConfirmation(
      "VaultValueChecker",
      [cVaultProxy.address, cOUSDProxy.address],
      undefined,
      true // Incompatibable storage layout
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
