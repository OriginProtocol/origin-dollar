const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "162_remove_morpho_gauntlet_strat",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "60184014889309972284258308471504854673823844252496292291463084114846234193707",
  },
  async () => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );
    const cStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: `Remove the Morpho Gauntlet Prime USDC Strategy from the OUSD Vault`,
      actions: [
        {
          // 1. Remove the Morpho Gauntlet strategy
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cStrategyProxy.address],
        },
      ],
    };
  }
);
