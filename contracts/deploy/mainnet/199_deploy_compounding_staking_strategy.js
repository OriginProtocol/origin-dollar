const addresses = require("../../utils/addresses");
const { beaconChainGenesisTimeMainnet } = require("../../utils/constants");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "199_deploy_compounding_staking_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
  },
  async ({ deployWithConfirmation, ethers, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );
    const cBeaconProofs = await ethers.getContract("BeaconProofs");
    const cCompoundingStakingSSVStrategyProxy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );
    const cCompoundingStakingSSVStrategy = await ethers.getContractAt(
      "CompoundingStakingSSVStrategy",
      cCompoundingStakingSSVStrategyProxy.address
    );
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

    console.log("Deploy CompoundingStakingSSVStrategy implementation");
    const dCompoundingStakingSSVStrategy = await deployWithConfirmation(
      "CompoundingStakingSSVStrategy",
      [
        [addresses.zero, cOETHVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSVNetwork, // ssvNetwork
        addresses.mainnet.beaconChainDepositContract, // beaconChainDepositContract
        cBeaconProofs.address, // beaconProofs
        beaconChainGenesisTimeMainnet,
      ]
    );

    console.log("Deploy NativeStakingSSVStrategy2 implementation");
    const dNativeStakingStrategy2 = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cOETHVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        cNativeStakingFeeAccumulator2Proxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beaconChainDepositContract
      ]
    );

    console.log("Deploy CompoundingStakingStrategyProxy");
    const dCompoundingStakingStrategyProxy = await deployWithConfirmation(
      "CompoundingStakingStrategyProxy"
    );
    const cCompoundingStakingStrategyProxy = await ethers.getContractAt(
      "CompoundingStakingStrategyProxy",
      dCompoundingStakingStrategyProxy.address
    );

    console.log("Deploy CompoundingStakingStrategy");
    const dCompoundingStakingStrategy = await deployWithConfirmation(
      "CompoundingStakingStrategy",
      [
        [addresses.zero, cOETHVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.beaconChainDepositContract, // beaconChainDepositContract
        cBeaconProofs.address, // beaconProofs
        beaconChainGenesisTimeMainnet,
      ]
    );
    const cCompoundingStakingStrategy = await ethers.getContractAt(
      "CompoundingStakingStrategy",
      dCompoundingStakingStrategy.address
    );

    console.log("Encode CompoundingStakingStrategy initialize call");
    const initData = cCompoundingStakingStrategy.interface.encodeFunctionData(
      "initialize(address[],address[],address[],uint256)",
      [
        [], // reward token addresses
        [], // asset token addresses
        [], // platform token addresses
        ethers.utils.parseEther("2030"), // initial validator deposit amount
      ]
    );

    console.log("Initialize CompoundingStakingStrategyProxy");
    await withConfirmation(
      cCompoundingStakingStrategyProxy.connect(sDeployer)[
        // eslint-disable-next-line no-unexpected-multiline
        "initialize(address,address,bytes)"
      ](
        cCompoundingStakingStrategy.address, // implementation address
        addresses.mainnet.Timelock, // governance
        initData // data for call to the initialize function on the strategy
      )
    );

    const cStrategy = await ethers.getContractAt(
      "CompoundingStakingStrategy",
      cCompoundingStakingStrategyProxy.address
    );

    console.log("Deploy CompoundingStakingStrategyView");
    await deployWithConfirmation(
      "CompoundingStakingStrategyView",
      [cCompoundingStakingStrategyProxy.address],
      "CompoundingStakingStrategyView"
    );

    console.log("Deploy ConsolidationController");
    const dConsolidationController = await deployWithConfirmation(
      "ConsolidationController",
      [
        addresses.mainnet.Guardian, // Admin 5/8 multisig
        addresses.mainnet.talosRelayer, // New Talos Relayer
        cNativeStakingStrategy2.address, // Old Native Staking Strategy 2
        cCompoundingStakingSSVStrategy.address, // Old Compounding Staking SSV Strategy
        cStrategy.address, // New Compounding Staking Strategy
      ]
    );

    const actions = [
      {
        contract: cCompoundingStakingSSVStrategyProxy,
        signature: "upgradeTo(address)",
        args: [dCompoundingStakingSSVStrategy.address],
      },
      {
        contract: cCompoundingStakingSSVStrategy,
        signature: "setRegistrator(address)",
        args: [dConsolidationController.address],
      },
      {
        contract: cNativeStakingStrategy2Proxy,
        signature: "upgradeTo(address)",
        args: [dNativeStakingStrategy2.address],
      },
      {
        contract: cOETHVault,
        signature: "approveStrategy(address)",
        args: [cCompoundingStakingStrategyProxy.address],
      },
      {
        contract: cOETHVault,
        signature: "setDefaultStrategy(address)",
        args: [cCompoundingStakingStrategyProxy.address],
      },
      {
        contract: cStrategy,
        signature: "setRegistrator(address)",
        args: [dConsolidationController.address],
      },
      {
        contract: cNativeStakingStrategy2,
        signature: "setRegistrator(address)",
        args: [dConsolidationController.address],
      },
    ];

    return {
      name: "Deploy new vanilla compounding staking strategy, upgrade SSV strategies and deploy consolidation controller",
      actions,
    };
  }
);
