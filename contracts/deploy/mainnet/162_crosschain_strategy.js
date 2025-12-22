const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { cctpDomainIds } = require("../../utils/cctp");
const { deployCrossChainMasterStrategyImpl } = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "162_crosschain_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cProxy = await ethers.getContractAt(
      "CrossChainStrategyProxy",
      addresses.CrossChainStrategyProxy
    );
    console.log(`CrossChainStrategyProxy address: ${cProxy.address}`);

    const implAddress = await deployCrossChainMasterStrategyImpl(
      addresses.CrossChainStrategyProxy,
      cctpDomainIds.Base,
      // Same address for both master and remote strategy
      addresses.CrossChainStrategyProxy,
      addresses.mainnet.USDC,
      "CrossChainMasterStrategy"
    );
    console.log(`CrossChainMasterStrategyImpl address: ${implAddress}`);

    const cCrossChainMasterStrategy = await ethers.getContractAt(
      "CrossChainMasterStrategy",
      addresses.CrossChainStrategyProxy
    );
    console.log(
      `CrossChainMasterStrategy address: ${cCrossChainMasterStrategy.address}`
    );

    // TODO: Set reward tokens to Morpho

    return {
      actions: [],
    };
  }
);
