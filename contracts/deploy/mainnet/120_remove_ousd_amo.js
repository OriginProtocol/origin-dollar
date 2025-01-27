const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "120_remove_ousd_amo",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cOUSDVaultProxy = await ethers.getContract("VaultProxy");
    const cOUSDVault = await ethers.getContractAt(
      "IVault",
      cOUSDVaultProxy.address
    );

    const cOUSDMetaStrategyProxy = await ethers.getContract(
      "ConvexOUSDMetaStrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Remove OUSD AMO Strategy",
      actions: [
        {
          contract: cOUSDVault,
          signature: "removeStrategy(address)",
          args: [cOUSDMetaStrategyProxy.address],
        },
      ],
    };
  }
);
