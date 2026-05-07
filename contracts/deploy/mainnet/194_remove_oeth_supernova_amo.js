const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "194_remove_oeth_supernova_amo",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    // Current OETH Vault contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);
    const cStrategyProxy = await ethers.getContract("OETHSupernovaAMOProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Remove the Supernova AMO Strategy from the OETH Vault",
      actions: [
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cStrategyProxy.address],
        },
      ],
    };
  }
);
