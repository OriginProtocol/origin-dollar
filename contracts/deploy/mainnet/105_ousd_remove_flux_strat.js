const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "105_ousd_remove_flux_strat",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: false,
    proposalId:
      "34347268131529952700500536280019071045711956672151609598093869968201379596367",
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
