const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
// const addresses = require("../../utils/addresses");
const {
  deployProxyWithCreateX,
  // deployCrossChainMasterStrategyImpl,
} = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "159_crosschain_strategy_proxies",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cctpHookWrapperProxyAddress = await deployProxyWithCreateX(
      "CCTPHookWrapperTest", // Salt
      "CCTPHookWrapperProxy"
    );
    console.log(`CCTPHookWrapperProxy address: ${cctpHookWrapperProxyAddress}`);

    // the salt needs to match the salt on the base chain deploying the other part of the strategy
    const salt = "CrossChain Strategy 1 Test";
    const proxyAddress = await deployProxyWithCreateX(
      salt,
      "CrossChainMasterStrategyProxy"
    );
    console.log(`CrossChainMasterStrategyProxy address: ${proxyAddress}`);

    // const implAddress = await deployCrossChainMasterStrategyImpl(proxyAddress);
    // console.log(`CrossChainMasterStrategyImpl address: ${implAddress}`);

    return {
      actions: [],
    };
  }
);
