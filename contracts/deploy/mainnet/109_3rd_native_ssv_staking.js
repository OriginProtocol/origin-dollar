const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../test/helpers.js");
const { impersonateAccount } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "109_3rd_native_ssv_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "105762082509768776202240604338417692927766202901146189706379006167687855789299",
  },
  async ({ deployWithConfirmation, ethers, getTxOpts, withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    console.log(`Using deployer account: ${deployerAddr}`);

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

    // 1. Fetch the strategy proxy deployed by Defender Relayer
    const cNativeStakingStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategy3Proxy"
    );
    console.log(
      `Native Staking Strategy 3 Proxy: ${cNativeStakingStrategyProxy.address}`
    );

    // 2. Deploy the new FeeAccumulator proxy
    console.log(`About to deploy FeeAccumulator proxy`);
    const dFeeAccumulatorProxy = await deployWithConfirmation(
      "NativeStakingFeeAccumulator3Proxy"
    );
    const cFeeAccumulatorProxy = await ethers.getContractAt(
      "NativeStakingFeeAccumulator3Proxy",
      dFeeAccumulatorProxy.address
    );

    // 3. Deploy the new FeeAccumulator implementation
    console.log(`About to deploy FeeAccumulator implementation`);
    const dFeeAccumulator = await deployWithConfirmation("FeeAccumulator", [
      cNativeStakingStrategyProxy.address, // _collector
    ]);
    const cFeeAccumulator = await ethers.getContractAt(
      "FeeAccumulator",
      dFeeAccumulator.address
    );

    // 4. Init the third FeeAccumulator proxy to point at the implementation, set the governor
    console.log(`About to initialize FeeAccumulator`);
    const proxyInitFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cFeeAccumulatorProxy.connect(sDeployer)[proxyInitFunction](
        cFeeAccumulator.address, // implementation address
        addresses.mainnet.Timelock, // governance
        "0x", // do not call any initialize functions
        await getTxOpts()
      )
    );

    // 5. Deploy the new Native Staking Strategy implementation
    console.log(`About to deploy NativeStakingSSVStrategy implementation`);
    const dNativeStakingStrategyImpl = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        dFeeAccumulatorProxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );
    const cNativeStakingStrategyImpl = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      dNativeStakingStrategyImpl.address
    );

    const cNativeStakingStrategy = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategyProxy.address
    );

    // 6. Initialize Native Staking Proxy with new implementation and strategy initialization
    console.log(`About to initialize NativeStakingSSVStrategy`);
    const initData = cNativeStakingStrategyImpl.interface.encodeFunctionData(
      "initialize(address[],address[],address[])",
      [
        [addresses.mainnet.WETH], // reward token addresses
        /* no need to specify WETH as an asset, since we have that overriden in the "supportsAsset"
         * function on the strategy
         */
        [], // asset token addresses
        [], // platform tokens addresses
      ]
    );

    /* Before kicking off the deploy script make sure the Defender relayer transfers the governance
     * of the proxy to the deployer account that shall be deploying this script so it will be able
     * to initialize the proxy contract
     *
     * Run the following to make it happen, and comment this error block out:
     * yarn run hardhat transferGovernanceNativeStakingProxy --index 3 --deployer 0xdeployerAddress --network mainnet
     */
    const proxyGovernor = await cNativeStakingStrategyProxy.governor();
    if (isFork && proxyGovernor != deployerAddr) {
      const relayerSigner = await impersonateAccount(
        addresses.mainnet.validatorRegistrator
      );
      await withConfirmation(
        cNativeStakingStrategyProxy
          .connect(relayerSigner)
          .transferGovernance(deployerAddr, await getTxOpts())
      );
    }

    // 7. Transfer governance of the Native Staking Strategy proxy to the deployer
    console.log(`About to claimGovernance of NativeStakingStrategyProxy`);
    await withConfirmation(
      cNativeStakingStrategyProxy
        .connect(sDeployer)
        .claimGovernance(await getTxOpts())
    );

    // 8. Init the proxy to point at the implementation, set the governor, and call initialize
    console.log(`About to initialize of NativeStakingStrategy`);
    await withConfirmation(
      cNativeStakingStrategyProxy.connect(sDeployer)[proxyInitFunction](
        cNativeStakingStrategyImpl.address, // implementation address
        addresses.mainnet.Timelock, // governance
        initData, // data for call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // 9. Safe approve SSV token spending
    console.log(`About to safeApproveAllTokens of NativeStakingStrategy`);
    await cNativeStakingStrategy.connect(sDeployer).safeApproveAllTokens();

    // Governance Actions
    // ----------------
    return {
      name: `Deploy a third OETH Native Staking Strategy.`,
      actions: [
        // 1. Add new strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cNativeStakingStrategyProxy.address],
        },
        // 2. configure Harvester to support the strategy
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cNativeStakingStrategyProxy.address, true],
        },
        // 3. set harvester to the strategy
        {
          contract: cNativeStakingStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // 4. configure the fuse interval
        {
          contract: cNativeStakingStrategy,
          signature: "setFuseInterval(uint256,uint256)",
          args: [
            ethers.utils.parseEther("21.6"),
            ethers.utils.parseEther("25.6"),
          ],
        },
        // 5. set validator registrator to the Defender Relayer
        {
          contract: cNativeStakingStrategy,
          signature: "setRegistrator(address)",
          // The Defender Relayer
          args: [addresses.mainnet.validatorRegistrator],
        },
        // 6. set staking threshold
        {
          contract: cNativeStakingStrategy,
          signature: "setStakeETHThreshold(uint256)",
          // 16 validators before the 5/8 multisig has to call resetStakeETHTally
          args: [ethers.utils.parseEther("512")], // 16 * 32ETH
        },
        // 7. set staking monitor
        {
          contract: cNativeStakingStrategy,
          signature: "setStakingMonitor(address)",
          // The 5/8 multisig
          args: [addresses.mainnet.Guardian],
        },
      ],
    };
  }
);
