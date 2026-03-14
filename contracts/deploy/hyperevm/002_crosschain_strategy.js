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
      "CrossChainStrategyProxy"
    );
    console.log(
      `CrossChainStrategyProxy address: ${crossChainStrategyProxyAddress}`
    );

    // TODO: Once a timelock is deployed on HyperEVM, replace the governor
    // argument below with addresses.hyperevm.timelock instead of the strategist.
    const implAddress = await deployCrossChainRemoteStrategyImpl(
      addresses.hyperevm.MorphoOusdV2Vault, // TODO: fill in Morpho V2 vault address on HyperEVM
      crossChainStrategyProxyAddress,
      cctpDomainIds.Ethereum, // 0
      // The master strategy has the same address on mainnet thanks to Create2
      crossChainStrategyProxyAddress,
      addresses.hyperevm.USDC,
      addresses.mainnet.USDC,
      "CrossChainRemoteStrategy",
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
      addresses.hyperevm.strategist // No timelock yet — using guardian as governor
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
      ],
    };
  }
);
