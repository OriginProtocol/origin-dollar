const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployProxyWithCreateX,
  deployYearn3RemoteStrategyImpl,
} = require("../deployActions");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy.js");

module.exports = deployOnBase(
  {
    deployName: "040_yearn_strategy",
  },
  async ({ ethers }) => {
    const salt = "Yean strategy 1";
    const proxyAddress = await deployProxyWithCreateX(
      salt,
      "CrossChainRemoteStrategyProxy"
    );
    console.log(`CrossChainRemoteStrategyProxy address: ${proxyAddress}`);

    const implAddress = await deployYearn3RemoteStrategyImpl(proxyAddress);
    console.log(`CrossChainRemoteStrategyImpl address: ${implAddress}`);

    return {
      actions: [],
    };
  }
);
