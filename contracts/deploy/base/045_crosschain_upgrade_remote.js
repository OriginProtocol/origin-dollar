const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployCrossChainRemoteStrategyImpl,
  getCreate2ProxyAddress,
} = require("../deployActions");
const { cctpDomainIds } = require("../../utils/cctp");

module.exports = deployOnBase(
  {
    deployName: "045_crosschain_upgrade_remote",
  },
  async () => {
    const crossChainStrategyProxyAddress = await getCreate2ProxyAddress(
      "CrossChainStrategyProxy"
    );
    console.log(
      `CrossChainStrategyProxy address: ${crossChainStrategyProxyAddress}`
    );

    const implAddress = await deployCrossChainRemoteStrategyImpl(
      addresses.base.MorphoOusdV2Vault, // 4626 Vault
      crossChainStrategyProxyAddress,
      cctpDomainIds.Ethereum,
      crossChainStrategyProxyAddress,
      addresses.base.USDC,
      addresses.mainnet.USDC,
      "CrossChainRemoteStrategy",
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
      addresses.base.timelock,
      false
    );
    console.log(`CrossChainRemoteStrategyImpl address: ${implAddress}`);

    const cCrossChainStrategyProxy = await ethers.getContractAt(
      "CrossChainStrategyProxy",
      crossChainStrategyProxyAddress
    );

    return {
      actions: [
        {
          contract: cCrossChainStrategyProxy,
          signature: "upgradeTo(address)",
          args: [implAddress],
        },
      ],
    };
  }
);
