const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "091_native_ssv_staking",
    forceDeploy: false,
    //forceSkip: true,
    deployerIsProposer: false,
    // proposalId:
    //   "",
  },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cVaultProxy.address
    );

    const cHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "OETHHarvester",
      cHarvesterProxy.address
    );

    // Deployer Actions
    // ----------------

    // 1. Deploy the new strategy proxy
    const dStrategyProxy = await deployWithConfirmation(
      "NativeStakingSSVStrategyProxy"
    );
    const cStrategyProxy = await ethers.getContractAt(
      "NativeStakingSSVStrategyProxy",
      dStrategyProxy.address
    );

    // 2. Deploy the new fee accumulator proxy
    const dFeeAccumulatorProxy = await deployWithConfirmation(
      "NativeStakingFeeAccumulatorProxy"
    );
    const cFeeAccumulatorProxy = await ethers.getContractAt(
      "NativeStakingFeeAccumulatorProxy",
      dFeeAccumulatorProxy.address
    );

    // 3. Deploy the new strategy implementation
    const dStrategyImpl = await deployWithConfirmation("NativeStakingSSVStrategy", [
      [addresses.zero, cVaultProxy.address], //_baseConfig
      addresses.mainnet.WETH, // wethAddress
      addresses.mainnet.SSV, // ssvToken
      addresses.mainnet.SSVNetwork, // ssvNetwork
      dFeeAccumulatorProxy.address // feeAccumulator
    ]);
    const cStrategyImpl = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      dStrategyImpl.address
    );
    const cStrategy = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      dStrategyProxy.address
    );

    // 3. Initialize Proxy with new implementation and strategy initialization
    const initData = cStrategyImpl.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [addresses.mainnet.WETH, addresses.mainnet.SSV], // reward token addresses
        /* no need to specify WETH as an asset, since we have that overriden in the "supportsAsset"
         * function on the strategy
         */
        [], // asset token addresses
        [], // platform tokens addresses
      ]
    );

    // 4. Init the proxy to point at the implementation, set the governor, and call initialize
    const proxyInitFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cStrategyProxy.connect(sDeployer)[proxyInitFunction](
        cStrategyImpl.address, // implementation address
        addresses.mainnet.Timelock, // governance
        initData, // data for call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // 5. Deploy the new fee accumulator implementation
    const dFeeAccumulator = await deployWithConfirmation("FeeAccumulator", [
      cStrategyProxy.address, // _collector
      addresses.mainnet.WETH // _weth
    ]);
    const cFeeAccumulator = await ethers.getContractAt(
      "FeeAccumulator",
      dFeeAccumulator.address
    );

    // 6. Init the fee accumulator proxy to point at the implementation, set the governor
    await withConfirmation(
      cFeeAccumulatorProxy.connect(sDeployer)[proxyInitFunction](
        cFeeAccumulator.address, // implementation address
        addresses.mainnet.Timelock, // governance
        "0x", // do not call any initialize functions
        await getTxOpts()
      )
    );

    // 7. Safe approve SSV token spending
    await cStrategy.connect(sDeployer).safeApproveAllTokens();

    console.log("Native Staking SSV Strategy address: ", cStrategyProxy.address);
    console.log("Fee accumulator address: ", cFeeAccumulator.address);

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new OETH Native Staking Strategy\n\nThis is going to become the main strategy to power the reward accrual of OETH by staking ETH into SSV validators.",
      actions: [
        // 1. Add new strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cStrategyProxy.address],
        },
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cStrategyProxy.address, true],
        },
        {
          contract: cStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
