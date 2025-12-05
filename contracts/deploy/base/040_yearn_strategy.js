const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { deployProxyWithCreateX, deployYearn3SlaveStrategyImpl } = require("../deployActions");
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
    const proxyAddress = await deployProxyWithCreateX(salt, "YearnV3SlaveStrategyProxy");
    console.log(`YearnV3SlaveStrategyProxy address: ${proxyAddress}`);
    
    const implAddress = await deployYearn3SlaveStrategyImpl(proxyAddress);
    console.log(`YearnV3SlaveStrategyImpl address: ${implAddress}`);

    return {
      actions: [
      ],
    };
  }
);
