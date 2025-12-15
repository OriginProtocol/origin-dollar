const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { cctpDomainIds } = require("../../utils/cctp");
const { deployCrossChainMasterStrategyImpl } = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "160_crosschain_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    console.log(`HookWrapperProxy address: ${addresses.HookWrapperProxy}`);
    const cHookWrapperProxy = await ethers.getContractAt(
      "CCTPHookWrapperProxy",
      addresses.HookWrapperProxy
    );
    console.log(
      `CrossChainStrategyProxy address: ${addresses.CrossChainStrategyProxy}`
    );

    await deployWithConfirmation("CCTPHookWrapper", [
      addresses.CCTPMessageTransmitterV2,
      addresses.CCTPTokenMessengerV2,
    ]);
    const cHookWrapperImpl = await ethers.getContract("CCTPHookWrapper");
    console.log(`CCTPHookWrapper address: ${cHookWrapperImpl.address}`);

    const cHookWrapper = await ethers.getContractAt(
      "CCTPHookWrapper",
      addresses.HookWrapperProxy
    );

    await withConfirmation(
      cHookWrapperProxy.connect(sDeployer).initialize(
        cHookWrapperImpl.address,
        deployerAddr, // TODO: change governor later
        "0x"
      )
    );

    const implAddress = await deployCrossChainMasterStrategyImpl(
      addresses.CrossChainStrategyProxy,
      cctpDomainIds.Base,
      // Same address for both master and remote strategy
      addresses.CrossChainStrategyProxy,
      addresses.mainnet.USDC,
      // Same address on all chains
      cHookWrapper.address,
      "CrossChainMasterStrategy"
    );
    console.log(`CrossChainMasterStrategyImpl address: ${implAddress}`);

    const cCrossChainMasterStrategy = await ethers.getContractAt(
      "CrossChainMasterStrategy",
      addresses.CrossChainStrategyProxy
    );
    console.log(
      `CrossChainMasterStrategy address: ${cCrossChainMasterStrategy.address}`
    );

    await withConfirmation(
      cCrossChainMasterStrategy.connect(sDeployer).setMinFinalityThreshold(
        2000 // standard transfer
      )
    );

    await withConfirmation(
      cHookWrapper
        .connect(sDeployer)
        .setPeer(
          cctpDomainIds.Base,
          addresses.CrossChainStrategyProxy,
          addresses.CrossChainStrategyProxy
        )
    );

    return {
      actions: [],
    };
  }
);
