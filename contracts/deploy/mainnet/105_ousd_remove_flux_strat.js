const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "105_ousd_remove_flux_strat",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    // proposalId: "",
  },
  async () => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    const cFluxStrategy = await ethers.getContract("FluxStrategyProxy");

    // Governance Actions
    // ----------------
    return {
      name: "Remove Flux strategy from the OUSD Vault",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cFluxStrategy.address],
        },
      ],
    };
  }
);
