const { deploymentWithProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithProposal(
  { deployName: "048_deposit_withdraw_tooling", forceDeploy: false },
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
