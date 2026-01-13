const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { deployProxyWithCreateX } = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "164_crosschain_strategy_proxies",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    // the salt needs to match the salt on the base chain deploying the other part of the strategy
    const salt = "Morpho V2 Crosschain Strategy";
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
