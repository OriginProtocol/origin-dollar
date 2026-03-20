const { deployOnHyperEVM } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployCrossChainRemoteStrategyImpl,
  getCreate2ProxyAddress,
} = require("../deployActions");
const { cctpDomainIds } = require("../../utils/cctp");

module.exports = deployOnHyperEVM(
  {
    deployName: "002_crosschain_strategy",
  },
  async () => {
    const crossChainStrategyProxyAddress = await getCreate2ProxyAddress(
      "CrossChainStrategyHyperEVMProxy"
    );
    console.log(
      `CrossChainStrategyProxy address: ${crossChainStrategyProxyAddress}`
    );

    const implAddress = await deployCrossChainRemoteStrategyImpl(
      addresses.hyperevm.MorphoOusdV2Vault,
      crossChainStrategyProxyAddress,
      cctpDomainIds.Ethereum, // 0
      // The master strategy has the same address on mainnet thanks to Create2
      crossChainStrategyProxyAddress,
      addresses.hyperevm.USDC,
      addresses.mainnet.USDC,
      "CrossChainRemoteStrategy",
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
      addresses.hyperevm.timelock
    );
    console.log(`CrossChainRemoteStrategyImpl address: ${implAddress}`);

    const cCrossChainRemoteStrategy = await ethers.getContractAt(
      "CrossChainRemoteStrategy",
      crossChainStrategyProxyAddress
    );
    console.log(
      `CrossChainRemoteStrategy address: ${cCrossChainRemoteStrategy.address}`
    );

    return {
      actions: [
        {
          contract: cCrossChainRemoteStrategy,
          signature: "safeApproveAllTokens()",
          args: [],
        },
        {
          contract: cCrossChainRemoteStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.multichainStrategist],
        },
        {
          contract: cCrossChainRemoteStrategy,
          signature: "setOperator(address)",
          args: [addresses.hyperevm.OZRelayerAddress],
        },
      ],
    };
  }
);
