const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { cctpDomainIds } = require("../../utils/cctp");
const {
  deployCrossChainMasterStrategyImpl,
  getCreate2ProxyAddress,
} = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "166_crosschain_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const crossChainStrategyProxyAddress = await getCreate2ProxyAddress(
      "CrossChainStrategyProxy"
    );
    const cProxy = await ethers.getContractAt(
      "CrossChainStrategyProxy",
      crossChainStrategyProxyAddress
    );
    console.log(`CrossChainStrategyProxy address: ${cProxy.address}`);

    const cVaultProxy = await ethers.getContract("VaultProxy");

    const implAddress = await deployCrossChainMasterStrategyImpl(
      crossChainStrategyProxyAddress,
      cctpDomainIds.Base,
      // Same address for both master and remote strategy
      crossChainStrategyProxyAddress,
      addresses.mainnet.USDC,
      cVaultProxy.address,
      "CrossChainMasterStrategy",
      false,
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
      addresses.mainnet.Timelock
    );
    console.log(`CrossChainMasterStrategyImpl address: ${implAddress}`);

    const cCrossChainMasterStrategy = await ethers.getContractAt(
      "CrossChainMasterStrategy",
      crossChainStrategyProxyAddress
    );
    console.log(
      `CrossChainMasterStrategy address: ${cCrossChainMasterStrategy.address}`
    );

    // TODO: Set reward tokens to Morpho

    return {
      actions: [],
    };
  }
);
