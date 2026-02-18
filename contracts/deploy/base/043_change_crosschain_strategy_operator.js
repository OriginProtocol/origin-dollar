const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "043_change_crosschain_strategy_operator",
  },
  async () => {
    const cCrossChainRemoteStrategy = await ethers.getContractAt(
      "CrossChainRemoteStrategy",
      addresses.base.CrossChainRemoteStrategy
    );

    return {
      actions: [
        {
          contract: cCrossChainRemoteStrategy,
          signature: "setOperator(address)",
          args: [addresses.base.OZRelayerAddress],
        },
      ],
    };
  }
);
