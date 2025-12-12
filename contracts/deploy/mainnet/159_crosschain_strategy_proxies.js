const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { deployProxyWithCreateX } = require("../deployActions");

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
      "CCTPHookWrapperTest22", // Salt
      "CCTPHookWrapperProxy"
    );
    console.log(`CCTPHookWrapperProxy address: ${cctpHookWrapperProxyAddress}`);

    // the salt needs to match the salt on the base chain deploying the other part of the strategy
    const salt = "CrossChain Strategy 22 Test";
    const proxyAddress = await deployProxyWithCreateX(
      salt,
      "CrossChainStrategyProxy"
    );
    console.log(`CrossChainStrategyProxy address: ${proxyAddress}`);

    return {
      actions: [],
    };
  }
);
