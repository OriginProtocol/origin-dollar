const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "139_remove_1st_native_ssv_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "58072692907258896292503342211403681374811708763269462372642180263959505348028",
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

    // 1. Fetch the first native strategy proxy
    const cNativeStakingStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategyProxy"
    );

    const cFeeAccumulatorProxy = await ethers.getContract(
      "NativeStakingFeeAccumulatorProxy"
    );

    // 2. Deploy the new Native Staking Strategy implementation
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

    // Governance Actions
    // ----------------
    return {
      name: `Remove the first native SSV staking strategy from the OETH Vault and claim the remaining SSV from the cluster`,
      actions: [
        // 1. Remove strategy from vault
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cNativeStakingStrategyProxy.address],
        },
        // 2. Upgrade the Native Staking Strategy Strategy
        {
          contract: cNativeStakingStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategyImpl.address],
        },
        // 3. Transfer governance to the Guardian
        {
          contract: cNativeStakingStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.multichainStrategist],
        },
        // The Guardian can then retrieve the SSV left in the cluster by calling claimGovernance, withdrawSSV and transferToken
      ],
    };
  }
);
