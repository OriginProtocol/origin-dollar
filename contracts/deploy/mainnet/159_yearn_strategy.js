const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
// const addresses = require("../../utils/addresses");
const {
  deployProxyWithCreateX,
  deployYearn3MasterStrategyImpl,
} = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "159_yearn_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    // the salt needs to match the salt on the base chain deploying the other part of the strategy
    const salt = "Yean strategy 1";
    const proxyAddress = await deployProxyWithCreateX(
      salt,
      "CrossChainMasterStrategyProxy"
    );
    console.log(`CrossChainMasterStrategyProxy address: ${proxyAddress}`);

    const implAddress = await deployYearn3MasterStrategyImpl(proxyAddress);
    console.log(`CrossChainMasterStrategyImpl address: ${implAddress}`);

    return {
      actions: [],
    };
  }
);
