const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "145_upgrade_native_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");

    // Deployer Actions
    // ----------------

    // 1. Fetch the Native Strategy proxies
    const cNativeStakingStrategyProxy_2 = await ethers.getContract(
      "NativeStakingSSVStrategy2Proxy"
    );

    const cNativeStakingStrategyProxy_3 = await ethers.getContract(
      "NativeStakingSSVStrategy3Proxy"
    );

    // 2. Fetch the Fee Accumulator proxies

    const cFeeAccumulatorProxy_2 = await ethers.getContract(
      "NativeStakingFeeAccumulator2Proxy"
    );

    const cFeeAccumulatorProxy_3 = await ethers.getContract(
      "NativeStakingFeeAccumulator3Proxy"
    );

    // 3. Deploy the BeaconOracle
    const dBeaconOracle = await deployWithConfirmation("BeaconOracle");
    console.log(`Deployed BeaconOracle ${dBeaconOracle.address}`);

    // 4. Deploy the new Native Staking Strategy implementation
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
        dBeaconOracle.address, // beaconOracle
      ],
      undefined,
      true // skipUpgradeSafety
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
        dBeaconOracle.address, // beaconOracle
      ],
      undefined,
      true // skipUpgradeSafety
    );
    console.log(
      `Deployed 3rd NativeStakingSSVStrategy ${dNativeStakingStrategyImpl_3.address}`
    );

    // Governance Actions
    // ----------------
    return {
      name: `Upgrade the Native Staking Strategies to support Pectra features like compounding validators and consolidation`,
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
      ],
    };
  }
);
