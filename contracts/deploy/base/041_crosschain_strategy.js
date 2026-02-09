const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployCrossChainRemoteStrategyImpl,
  getCreate2ProxyAddress,
} = require("../deployActions");
const { cctpDomainIds } = require("../../utils/cctp");

module.exports = deployOnBase(
  {
    deployName: "041_crosschain_strategy",
  },
  async () => {
    const crossChainStrategyProxyAddress = await getCreate2ProxyAddress(
      "CrossChainStrategyProxy"
    );
    console.log(
      `CrossChainStrategyProxy address: ${crossChainStrategyProxyAddress}`
    );

    const implAddress = await deployCrossChainRemoteStrategyImpl(
      "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183", // 4626 Vault
      crossChainStrategyProxyAddress,
      cctpDomainIds.Ethereum,
      crossChainStrategyProxyAddress,
      addresses.base.USDC,
      addresses.mainnet.USDC,
      "CrossChainRemoteStrategy",
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
      addresses.base.timelock
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
      ],
    };
  }
);
