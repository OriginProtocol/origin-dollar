const { deployOnBase } = require("../../utils/deploy-l2");
// const addresses = require("../../utils/addresses");
const {
  deployProxyWithCreateX,
  // deployCrossChainRemoteStrategyImpl,
} = require("../deployActions");
// const {
//   deployWithConfirmation,
//   withConfirmation,
// } = require("../../utils/deploy.js");

module.exports = deployOnBase(
  {
    deployName: "040_crosschain_strategy_proxies",
  },
  async () => {
    const salt = "CrossChain Strategy 1 Test";
    const proxyAddress = await deployProxyWithCreateX(
      salt,
      "CrossChainRemoteStrategyProxy"
    );
    console.log(`CrossChainRemoteStrategyProxy address: ${proxyAddress}`);

    // const implAddress = await deployCrossChainRemoteStrategyImpl(proxyAddress);
    // console.log(`CrossChainRemoteStrategyImpl address: ${implAddress}`);

    return {
      actions: [],
    };
  }
);
