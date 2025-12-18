const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { deployCrossChainRemoteStrategyImpl } = require("../deployActions");
const { withConfirmation } = require("../../utils/deploy.js");
const { cctpDomainIds } = require("../../utils/cctp");

module.exports = deployOnBase(
  {
    deployName: "041_crosschain_strategy",
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    console.log(
      `CrossChainStrategyProxy address: ${addresses.CrossChainStrategyProxy}`
    );

    const implAddress = await deployCrossChainRemoteStrategyImpl(
      "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183", // 4626 Vault
      addresses.CrossChainStrategyProxy,
      cctpDomainIds.Ethereum,
      addresses.CrossChainStrategyProxy,
      addresses.base.USDC,
      "CrossChainRemoteStrategy"
    );
    console.log(`CrossChainRemoteStrategyImpl address: ${implAddress}`);

    const cCrossChainRemoteStrategy = await ethers.getContractAt(
      "CrossChainRemoteStrategy",
      addresses.CrossChainStrategyProxy
    );
    console.log(
      `CrossChainRemoteStrategy address: ${cCrossChainRemoteStrategy.address}`
    );

    await withConfirmation(
      cCrossChainRemoteStrategy.connect(sDeployer).setMinFinalityThreshold(
        2000 // standard transfer
      )
    );

    await withConfirmation(
      cCrossChainRemoteStrategy.connect(sDeployer).safeApproveAllTokens()
    );

    return {
      actions: [],
    };
  }
);
