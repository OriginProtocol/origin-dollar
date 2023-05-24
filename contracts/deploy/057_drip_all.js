const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { isMainnet } = require("../test/helpers.js");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "057_drip_all",
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
    // const cHarvester = await ethers.getContract("Harvester");

    const dVaultCore = await deployWithConfirmation("VaultCore");
    const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

    const cVaultCore = await ethers.getContract(
      "VaultCore",
      cVaultProxy.address
    );
    const cVaultAdmin = await ethers.getContract(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Drip all yield",
      actions: [
        // 1. Set VaultCore implementation
        {
          // Set VaultCore implementation
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. Set VaultAdmin implementation
        // {
        //   contract: cVaultCore,
        //   signature: "setAdminImpl(address)",
        //   args: [dVaultAdmin.address],
        // },
        // 3. Set dripper duration
        // {
        //   // Set VaultCore implementation
        //   contract: cVaultAdmin,
        //   signature: "setDripDuration(uint64)",
        //   args: [7*24*60*60],
        // },
        // 4. Send harvest rewards directly to the vault
        // 5. Collect funds from old dripper
        // 6. Send funds to vault
        // 7. Collect some more funds from around
      ],
    };
  }
);
