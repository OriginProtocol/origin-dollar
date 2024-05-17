const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
} = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "096_vault_admin_upgrade",
    // forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    // Deploy VaultAdmin implementation
    await deployWithConfirmation("OETHVaultAdmin");
    const dVaultAdminImpl = await ethers.getContract("OETHVaultAdmin");

    return {
      name: "Upgrade OETH Vault\n\
    \n\
    Part of simplified OETH proposal. This adds the ability to remove a supported asset from the Vault. \
    ",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setAdminImpl(address)",
          args: [dVaultAdminImpl.address],
        },
        {
          contract: cVaultAdmin,
          signature: "removeAsset(address)",
          args: [addresses.mainnet.frxETH],
        },
      ],
    };
  }
);
