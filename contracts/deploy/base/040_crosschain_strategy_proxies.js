const { deployOnBase } = require("../../utils/deploy-l2");
const { deployProxyWithCreateX } = require("../deployActions");

module.exports = deployOnBase(
  {
    deployName: "040_crosschain_strategy_proxies",
  },
  async () => {
    const cctpHookWrapperProxyAddress = await deployProxyWithCreateX(
      "CCTPHookWrapperTest222", // Salt
      "CCTPHookWrapperProxy"
    );
    console.log(`CCTPHookWrapperProxy address: ${cctpHookWrapperProxyAddress}`);

    // the salt needs to match the salt on the base chain deploying the other part of the strategy
    const salt = "CrossChain Strategy 222 Test";
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
