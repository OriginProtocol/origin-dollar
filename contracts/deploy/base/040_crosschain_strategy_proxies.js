const { deployOnBase } = require("../../utils/deploy-l2");
const { deployProxyWithCreateX } = require("../deployActions");

module.exports = deployOnBase(
  {
    deployName: "040_crosschain_strategy_proxies",
  },
  async () => {
    // the salt needs to match the salt on the base chain deploying the other part of the strategy
    const salt = "Morpho V2 Crosschain Strategy 1 Test 2";
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
