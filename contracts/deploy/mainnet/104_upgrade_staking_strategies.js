const { deploymentWithGovernanceProposal } = require("../../utils/deploy.js");
const addresses = require("../../utils/addresses.js");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "104_upgrade_staking_strategies",
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

    // 1. Fetch the first strategy proxy deployed by Defender Relayer
    const cNativeStakingStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategyProxy"
    );
    const cNativeStakingStrategy = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategyProxy.address
    );
    console.log(
      `cNativeStakingStrategyProxy ${cNativeStakingStrategyProxy.address}`
    );

    // 2. Fetch the first Fee Accumulator proxy
    const cFeeAccumulatorProxy = await ethers.getContract(
      "NativeStakingFeeAccumulatorProxy"
    );
    console.log(`cFeeAccumulatorProxy ${cFeeAccumulatorProxy.address}`);

    // 3. Deploy new implementation for the first Native Staking Strategy
    console.log(
      `About to deploy the first NativeStakingSSVStrategy implementation`
    );
    const dNativeStakingStrategyImpl = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        cFeeAccumulatorProxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );

    // 4. Fetch the second strategy proxy deployed by Defender Relayer
    const cNativeStakingStrategy2Proxy = await ethers.getContract(
      "NativeStakingSSVStrategy2Proxy"
    );
    const cNativeStakingStrategy2 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategy2Proxy.address
    );
    console.log(
      `Native Staking Strategy 2 Proxy: ${cNativeStakingStrategy2Proxy.address}`
    );

    // 5. Fetch the second Fee Accumulator proxy
    const cFeeAccumulator2Proxy = await ethers.getContract(
      "NativeStakingFeeAccumulator2Proxy"
    );
    console.log(`cFeeAccumulator2Proxy ${cFeeAccumulator2Proxy.address}`);

    // 3. Deploy new implementation for the second Native Staking Strategy
    console.log(
      `About to deploy the second NativeStakingSSVStrategy implementation`
    );
    const dNativeStakingStrategy2Impl = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        cFeeAccumulator2Proxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );

    // Governance Actions
    // ----------------
    return {
      name: `Upgrade both OETH Native Staking Strategy.

Set the FeeAccumulator's to receive MEV rewards`,
      actions: [
        // 1. Upgrade the first Native Staking Strategy
        {
          contract: cNativeStakingStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategyImpl.address],
        },
        // 2. Set the first FeeAccumulator to receive MEV rewards
        {
          contract: cNativeStakingStrategy,
          signature: "setFeeRecipient()",
          args: [],
        },
        // 3. Upgrade the second Native Staking Strategy
        {
          contract: cNativeStakingStrategy2Proxy,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategy2Impl.address],
        },
        // 4. Set the second FeeAccumulator to receive MEV rewards
        {
          contract: cNativeStakingStrategy2,
          signature: "setFeeRecipient()",
          args: [],
        },
      ],
    };
  }
);
