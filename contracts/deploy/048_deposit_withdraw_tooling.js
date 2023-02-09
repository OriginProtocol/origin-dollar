const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "048_deposit_withdraw_tooling",
    forceDeploy: false,
    //proposalId: "40434364243407050666554191388123037800510237271029051418887027936281231737485"
  },
  async ({
    assetAddresses,
    deployWithConfirmation,
  ethers,
    getTxOpts,
    withConfirmation,
  }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");

    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new withdrawal utils",
      actions: [
        // 1. Set VaultAdmin implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
      ],
    };
  }
);
