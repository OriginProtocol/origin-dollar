const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "196_remove_oeth_convex_amo",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "", // Add once the proposal has been created on-chain
  },
  async ({ ethers }) => {
    // Current OETH Vault contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    // Convex OETH/ETH AMO Strategy (0x1827F9eA98E0bf96550b2FC20F7233277FcD7E63)
    // The old Curve OETH/ETH pool used by this AMO is no longer used.
    const cStrategyProxy = await ethers.getContract(
      "ConvexEthMetaStrategyProxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Remove the Convex AMO Strategy from the OETH Vault",
      actions: [
        {
          // removeStrategy withdraws all assets from the strategy back to the
          // Vault before marking it as unsupported.
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cStrategyProxy.address],
        },
      ],
    };
  }
);
