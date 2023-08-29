const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const { isMainnet } = require("../test/helpers.js");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "048_deposit_withdraw_tooling",
    forceDeploy: false,
    //proposalId: "40434364243407050666554191388123037800510237271029051418887027936281231737485"
  },
  async ({ deployWithConfirmation, ethers }) => {
    let dVaultAdmin;

    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);

    // has already been ran on the mainnet and deployed to: 0x1eF0553FEb80e6f133cAe3092e38F0b23dA6452b
    if (!isMainnet) {
      dVaultAdmin = await deployWithConfirmation("VaultAdmin");
    }

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new withdrawal utils",
      actions: [
        // 1. Set VaultAdmin implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          // the implementation has already been ran on the mainnet and deployed to below address
          args: [
            isMainnet
              ? "0x1eF0553FEb80e6f133cAe3092e38F0b23dA6452b"
              : dVaultAdmin.address,
          ],
        },
      ],
    };
  }
);
