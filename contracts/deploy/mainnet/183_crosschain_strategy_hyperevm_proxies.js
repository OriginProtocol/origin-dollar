const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { deployProxyWithCreateX } = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "183_crosschain_strategy_hyperevm_proxies",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    // Different salt from Base ("Morpho V2 Crosschain Strategy 1") to get a new proxy address.
    // This SAME salt must be used in hyperevm/001_crosschain_strategy_proxies.js so that
    // the proxy address is identical on both chains via Create2.
    const salt = "Morpho V2 Crosschain Strategy (HyperEVM)";
    const proxyAddress = await deployProxyWithCreateX(
      salt,
      "CrossChainStrategyProxy",
      false,
      null,
      "CrossChainStrategyHyperEVMProxy"
    );
    console.log(`CrossChainStrategyProxy (HyperEVM) address: ${proxyAddress}`);

    return {
      actions: [],
    };
  }
);
