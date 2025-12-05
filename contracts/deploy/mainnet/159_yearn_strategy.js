const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { deployProxyWithCreateX } = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "159_yearn_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation }) => {
    // the salt needs to match the salt on the base chain deploying the other part of the strategy
    const salt = "Yean strategy 1";
    const proxyAddress = await deployProxyWithCreateX(salt);
    console.log(`Proxy address: ${proxyAddress}`);
    
    
    return {
      actions: [],
    };
  }
);
