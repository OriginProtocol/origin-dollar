const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "071_upgrade_oeth_vault",
    forceDeploy: false,
    //forceSkip: true,
    deployerIsProposer: true,
    //proposalId: ,
  },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy new Vault Admin implementation
    // Need to override the storage safety check as we are
    // adding isMultiAssets to the Strategy struct used in the strategies mapping
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVaultAdmin",
      [],
      undefined,
      true
    );
    const cOETHVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cOETHVaultProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Upgrade OETH Vault",
      actions: [
        // 1. set the new admin vault implementation
        {
          contract: cOETHVaultAdmin,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        }
      ],
    };
  }
);
