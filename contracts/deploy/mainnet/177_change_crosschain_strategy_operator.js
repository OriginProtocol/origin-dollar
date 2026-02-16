const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "177_change_crosschain_strategy_operator",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cCrossChainMasterStrategy = await ethers.getContractAt(
      "CrossChainMasterStrategy",
      addresses.mainnet.CrossChainMasterStrategy
    );

    return {
      name: "Change Operator of Crosschain Strategy",
      actions: [
        {
          contract: cCrossChainMasterStrategy,
          signature: "setOperator(address)",
          args: [addresses.mainnet.validatorRegistrator],
        },
      ],
    };
  }
);
