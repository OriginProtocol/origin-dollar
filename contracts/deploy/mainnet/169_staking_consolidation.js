const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { beaconChainGenesisTimeMainnet } = require("../../utils/constants");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "169_staking_consolidation",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

    const cCompoundingStakingStrategyProxy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );
    const cCompoundingStakingSSVStrategy = await ethers.getContractAt(
      "CompoundingStakingSSVStrategy",
      cCompoundingStakingStrategyProxy.address
    );
    const cBeaconProofs = await ethers.getContract("BeaconProofs");

    const cNativeStakingStrategy2Proxy = await ethers.getContract(
      "NativeStakingSSVStrategy2Proxy"
    );
    const cNativeStakingFeeAccumulator2Proxy = await ethers.getContract(
      "NativeStakingFeeAccumulator2Proxy"
    );
    const cNativeStakingStrategy2 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategy2Proxy.address
    );
    const cNativeStakingStrategy3Proxy = await ethers.getContract(
      "NativeStakingSSVStrategy3Proxy"
    );
    const cNativeStakingFeeAccumulator3Proxy = await ethers.getContract(
      "NativeStakingFeeAccumulator3Proxy"
    );
    const cNativeStakingStrategy3 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategy3Proxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy the new Compounding Staking Strategy contracts

    console.log("Deploy CompoundingStakingSSVStrategy");
    const dCompoundingStakingStrategy = await deployWithConfirmation(
      "CompoundingStakingSSVStrategy",
      [
        [addresses.zero, cOETHVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        addresses.mainnet.beaconChainDepositContract, // depositContractMock
        cBeaconProofs.address, // BeaconProofs
        beaconChainGenesisTimeMainnet,
      ]
    );

    // 2. Deploy the new Native Staking Strategy implementations

    console.log(`About to deploy NativeStakingSSVStrategy implementations`);
    const dNativeStakingStrategy2Impl = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cOETHVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        cNativeStakingFeeAccumulator2Proxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );
    const dNativeStakingStrategy3Impl = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cOETHVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        cNativeStakingFeeAccumulator3Proxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );

    // 3. Deploy the new Consolidation Controller
    console.log(`Deploy ConsolidationController`);
    const dConsolidationController = await deployWithConfirmation(
      "ConsolidationController",
      [
        addresses.mainnet.Guardian, // Admin 5/8 multisig
        addresses.mainnet.validatorRegistrator, // Defender Relayer
      ]
    );

    console.log(`Finished deploying contracts`);

    // Governance Actions
    // ----------------
    return {
      name: `Update old Native Staking Strategies and new Compounding Staking Strategy`,
      actions: [
        // 1. Upgrade Compounding Staking Strategy
        {
          contract: cCompoundingStakingStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dCompoundingStakingStrategy.address],
        },
        // 2. Upgrade Native Staking Strategy 2
        {
          contract: cNativeStakingStrategy2Proxy,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategy2Impl.address],
        },
        // 3. Upgrade Native Staking Strategy 3
        {
          contract: cNativeStakingStrategy3Proxy,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategy3Impl.address],
        },
        // 4. Set the Registrator of the Compounding Staking Strategy to the Consolidation Controller
        {
          contract: cCompoundingStakingSSVStrategy,
          signature: "setRegistrator(address)",
          args: [dConsolidationController.address],
        },
        // 5. Set the Registrator of the Native Staking Strategy 2 to the Consolidation Controller
        {
          contract: cNativeStakingStrategy2,
          signature: "setRegistrator(address)",
          args: [dConsolidationController.address],
        },
        // 6. Set the Registrator of the Native Staking Strategy 3 to the Consolidation Controller
        {
          contract: cNativeStakingStrategy3,
          signature: "setRegistrator(address)",
          args: [dConsolidationController.address],
        },
      ],
    };
  }
);
