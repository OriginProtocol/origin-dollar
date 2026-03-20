const { deployOnHyperEVM } = require("../../utils/deploy-l2");
const { deployProxyWithCreateX } = require("../deployActions");

module.exports = deployOnHyperEVM(
  {
    deployName: "001_crosschain_strategy_proxies",
  },
  async () => {
    // MUST match salt in mainnet/183_crosschain_strategy_hyperevm_proxies.js
    // so that the proxy address is identical on both chains via Create2
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
