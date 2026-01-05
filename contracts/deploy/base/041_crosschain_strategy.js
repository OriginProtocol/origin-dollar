const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployCrossChainRemoteStrategyImpl,
  getCreate2ProxyAddress,
} = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy.js");
const { cctpDomainIds } = require("../../utils/cctp");

module.exports = deployOnBase(
  {
    deployName: "041_crosschain_strategy",
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

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
      "CrossChainRemoteStrategy",
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
      deployerAddr
    );
    console.log(`CrossChainRemoteStrategyImpl address: ${implAddress}`);

    const cCrossChainRemoteStrategy = await ethers.getContractAt(
      "CrossChainRemoteStrategy",
      crossChainStrategyProxyAddress
    );
    console.log(
      `CrossChainRemoteStrategy address: ${cCrossChainRemoteStrategy.address}`
    );

    // TODO: Move to governance actions when going live
    await withConfirmation(
      cCrossChainRemoteStrategy.connect(sDeployer).safeApproveAllTokens()
    );

    return {
      // actions: [{
      //   contract: cCrossChainRemoteStrategy,
      //   signature: "safeApproveAllTokens()",
      //   args: [],
      // }],
    };
  }
);
