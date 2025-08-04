const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { deployCompoundingStakingSSVStrategy } = require("../deployActions");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "152_upgrade_native_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cVaultProxy.address
    );
    // Deployer Actions
    // ----------------

    // 1. Fetch the Native Strategy proxies
    const cNativeStakingStrategyProxy_2 = await ethers.getContract(
      "NativeStakingSSVStrategy2Proxy"
    );
    const cNativeStakingStrategy2 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategyProxy_2.address
    );
    const cNativeStakingStrategyProxy_3 = await ethers.getContract(
      "NativeStakingSSVStrategy3Proxy"
    );
    const cNativeStakingStrategy3 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategyProxy_3.address
    );

    // 2. Fetch the Fee Accumulator proxies
    const cFeeAccumulatorProxy_2 = await ethers.getContract(
      "NativeStakingFeeAccumulator2Proxy"
    );
    const cFeeAccumulatorProxy_3 = await ethers.getContract(
      "NativeStakingFeeAccumulator3Proxy"
    );

    // 3. Deploy the new Native Staking Strategy implementation
    const dNativeStakingStrategyImpl_2 = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        cFeeAccumulatorProxy_2.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );
    console.log(
      `Deployed 2nd NativeStakingSSVStrategy ${dNativeStakingStrategyImpl_2.address}`
    );

    const dNativeStakingStrategyImpl_3 = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        cFeeAccumulatorProxy_3.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ],
      undefined,
      true // skipUpgradeSafety
    );
    console.log(
      `Deployed 3rd NativeStakingSSVStrategy ${dNativeStakingStrategyImpl_3.address}`
    );

    // 4. Deploy the new Compounding Staking Strategy contracts
    const cCompoundingStakingStrategy =
      await deployCompoundingStakingSSVStrategy();

    // Governance Actions
    // ----------------
    return {
      name: `Upgrade the existing Native Staking Strategies and deploy new Compounding Staking Strategy`,
      actions: [
        // 1. Upgrade the second Native Staking Strategy
        {
          contract: cNativeStakingStrategyProxy_2,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategyImpl_2.address],
        },
        // 2. Upgrade the third Native Staking Strategy
        {
          contract: cNativeStakingStrategyProxy_3,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategyImpl_3.address],
        },
        // 3. Add the new compounding strategy as a consolidation target
        {
          contract: cNativeStakingStrategy2,
          signature: "addTargetStrategy(address)",
          args: [cCompoundingStakingStrategy.address],
        },
        // 4. Add the new compounding strategy as a consolidation target
        {
          contract: cNativeStakingStrategy3,
          signature: "addTargetStrategy(address)",
          args: [cCompoundingStakingStrategy.address],
        },
        // 5. Add new strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cCompoundingStakingStrategy.address],
        },
        // 6. set harvester to the Defender Relayer
        {
          contract: cCompoundingStakingStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.mainnet.validatorRegistrator],
        },
        // 7. set validator registrator to the Defender Relayer
        {
          contract: cCompoundingStakingStrategy,
          signature: "setRegistrator(address)",
          // The Defender Relayer
          args: [addresses.mainnet.validatorRegistrator],
        },
        // 8. add the 2nd Native Staking Strategy as a source strategy
        {
          contract: cCompoundingStakingStrategy,
          signature: "addSourceStrategy(address)",
          args: [cNativeStakingStrategyProxy_2.address],
        },
        // 9. add the 3rd Native Staking Strategy as a source strategy
        {
          contract: cCompoundingStakingStrategy,
          signature: "addSourceStrategy(address)",
          args: [cNativeStakingStrategyProxy_3.address],
        },
      ],
    };
  }
);
