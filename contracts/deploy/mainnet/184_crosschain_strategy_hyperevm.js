const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { cctpDomainIds } = require("../../utils/cctp");
const {
  deployCrossChainMasterStrategyImpl,
  getCreate2ProxyAddress,
} = require("../deployActions");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "184_crosschain_strategy_hyperevm",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const crossChainStrategyProxyAddress = await getCreate2ProxyAddress(
      "CrossChainStrategyHyperEVMProxy"
    );
    console.log(
      `CrossChainStrategyProxy (HyperEVM) address: ${crossChainStrategyProxyAddress}`
    );

    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    const implAddress = await deployCrossChainMasterStrategyImpl(
      crossChainStrategyProxyAddress,
      cctpDomainIds.HyperEVM, // 19
      // The remote strategy has the same address on HyperEVM thanks to Create2
      crossChainStrategyProxyAddress,
      addresses.mainnet.USDC,
      addresses.hyperevm.USDC,
      cVaultProxy.address,
      "CrossChainMasterStrategy",
      false,
      addresses.CCTPTokenMessengerV2,
      addresses.CCTPMessageTransmitterV2,
      addresses.mainnet.Timelock
    );
    console.log(
      `CrossChainMasterStrategyImpl (HyperEVM) address: ${implAddress}`
    );

    const cCrossChainMasterStrategy = await ethers.getContractAt(
      "CrossChainMasterStrategy",
      crossChainStrategyProxyAddress
    );
    console.log(
      `CrossChainMasterStrategy (HyperEVM) address: ${cCrossChainMasterStrategy.address}`
    );

    return {
      name: "Add HyperEVM Morpho V2 Crosschain Strategy to OUSD Vault",
      actions: [
        {
          contract: cVault,
          signature: "approveStrategy(address)",
          args: [crossChainStrategyProxyAddress],
        },
      ],
    };
  }
);
