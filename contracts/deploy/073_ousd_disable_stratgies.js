const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "073_disable_strategies",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: false,
    deployerIsProposer: true,
    proposalId:
      "30894412376194853647122581916496530536830189795097427662392821757029264128284",
  },
  async () => {
    // Current OUSD Vault contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    const cCompStrategy = await ethers.getContract("CompoundStrategyProxy");
    const cConvexStrategy = await ethers.getContract("ConvexStrategyProxy");
    const cConvexLUSDStrategy = await ethers.getContract(
      "ConvexLUSDMetaStrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Remove Compound and Convex strategies from the OUSD Vault",
      actions: [
        // Remove the Compound strategy
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cCompStrategy.address],
        },
        // Remove the Convex DAI+USDC+USDT strategy
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cConvexStrategy.address],
        },
        // Remove the Convex LUSD strategy
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cConvexLUSDStrategy.address],
        },
      ],
    };
  }
);
