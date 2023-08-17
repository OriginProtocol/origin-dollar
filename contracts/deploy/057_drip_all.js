const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "057_drip_all",
    forceDeploy: false,
    forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    //proposalId: "40434364243407050666554191388123037800510237271029051418887027936281231737485"
  },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    // const cHarvester = await ethers.getContract("Harvester");

    const dVaultCore = await deployWithConfirmation("VaultCore");
    // const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

    // const cVaultCore = await ethers.getContract(
    //   "VaultCore",
    //   cVaultProxy.address
    // );
    // const cVaultAdmin = await ethers.getContract(
    //   "VaultAdmin",
    //   cVaultProxy.address
    // );

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
