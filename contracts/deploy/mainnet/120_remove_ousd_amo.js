const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "120_remove_ousd_amo",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "47377301530901645877668147419124102540503539821842750844128770769774878595548",
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
        {
          contract: cOUSDVault,
          signature: "setOusdMetaStrategy(address)",
          args: [addresses.zero],
        },
      ],
    };
  }
);
