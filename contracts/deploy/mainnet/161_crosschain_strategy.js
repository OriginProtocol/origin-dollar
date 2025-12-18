const {
  deploymentWithGovernanceProposal,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { cctpDomainIds } = require("../../utils/cctp");
const { deployCrossChainMasterStrategyImpl } = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "160_crosschain_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    console.log(
      `CrossChainStrategyProxy address: ${addresses.CrossChainStrategyProxy}`
    );

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

    await withConfirmation(
      cCrossChainMasterStrategy.connect(sDeployer).setMinFinalityThreshold(
        2000 // standard transfer
      )
    );

    return {
      actions: [],
    };
  }
);
