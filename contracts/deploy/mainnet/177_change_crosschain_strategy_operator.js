const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "177_change_crosschain_strategy_operator",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "44576067657297086005253513834508683316408185013245459259067058344639958414003",
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
