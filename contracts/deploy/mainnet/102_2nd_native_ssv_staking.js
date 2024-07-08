const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../test/helpers.js");
const { impersonateAccount } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "102_2nd_native_ssv_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
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
    const cNativeStakingStrategy2Proxy = await ethers.getContract(
      "NativeStakingSSVStrategy2Proxy"
    );
    console.log(
      `Native Staking Strategy 2 Proxy: ${cNativeStakingStrategy2Proxy.address}`
    );

    // 2. Deploy the new FeeAccumulator proxy
    console.log(`About to deploy FeeAccumulator proxy`);
    const dFeeAccumulator2Proxy = await deployWithConfirmation(
      "NativeStakingFeeAccumulator2Proxy"
    );
    const cFeeAccumulator2Proxy = await ethers.getContractAt(
      "NativeStakingFeeAccumulator2Proxy",
      dFeeAccumulator2Proxy.address
    );

    // 3. Deploy the new FeeAccumulator implementation
    console.log(`About to deploy FeeAccumulator2 implementation`);
    const dFeeAccumulator2 = await deployWithConfirmation("FeeAccumulator2", [
      cNativeStakingStrategy2Proxy.address, // _collector
    ]);
    const cFeeAccumulator2 = await ethers.getContractAt(
      "FeeAccumulator2",
      dFeeAccumulator2.address
    );

    // 4. Init the Second FeeAccumulator proxy to point at the implementation, set the governor
    console.log(`About to initialize FeeAccumulator2`);
    const proxyInitFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cFeeAccumulator2Proxy.connect(sDeployer)[proxyInitFunction](
        cFeeAccumulator2.address, // implementation address
        addresses.mainnet.Timelock, // governance
        "0x", // do not call any initialize functions
        await getTxOpts()
      )
    );

    // 5. Deploy the new Native Staking Strategy implementation
    console.log(`About to deploy NativeStakingSSVStrategy2 implementation`);
    const dNativeStakingStrategy2Impl = await deployWithConfirmation(
      "NativeStakingSSVStrategy2",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        500, // maxValidators
        dFeeAccumulator2Proxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );
    const cNativeStakingStrategy2Impl = await ethers.getContractAt(
      "NativeStakingSSVStrategy2",
      dNativeStakingStrategy2Impl.address
    );

    const cNativeStakingStrategy2 = await ethers.getContractAt(
      "NativeStakingSSVStrategy2",
      cNativeStakingStrategy2Proxy.address
    );

    // 6. Initialize Native Staking Proxy with new implementation and strategy initialization
    console.log(`About to initialize NativeStakingSSVStrategy`);
    const initData = cNativeStakingStrategy2Impl.interface.encodeFunctionData(
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

    const proxyGovernor = await cNativeStakingStrategy2Proxy.governor();
    if (isFork && proxyGovernor != deployerAddr) {
      const relayerSigner = await impersonateAccount(
        addresses.mainnet.validatorRegistrator
      );
      await withConfirmation(
        cNativeStakingStrategy2Proxy
          .connect(relayerSigner)
          .transferGovernance(deployerAddr, await getTxOpts())
      );
    } else {
      /* Before kicking off the deploy script make sure the Defender relayer transfers the governance
       * of the proxy to the deployer account that shall be deploying this script so it will be able
       * to initialize the proxy contract
       *
       * Run the following to make it happen, and comment this error block out:
       * yarn run hardhat transferGovernanceNativeStakingProxy --address 0xdeployerAddress  --network mainnet
       */
      if (proxyGovernor != deployerAddr) {
        throw new Error(
          `Native Staking Strategy proxy's governor: ${proxyGovernor} does not match current deployer ${deployerAddr}`
        );
      }
    }

    // 7. Transfer governance of the Native Staking Strategy 2 proxy to the deployer
    console.log(`About to claimGovernance of NativeStakingStrategyProxy`);
    await withConfirmation(
      cNativeStakingStrategy2Proxy
        .connect(sDeployer)
        .claimGovernance(await getTxOpts())
    );

    // 8. Init the proxy to point at the implementation, set the governor, and call initialize
    console.log(`About to initialize of NativeStakingStrategy2`);
    await withConfirmation(
      cNativeStakingStrategy2Proxy.connect(sDeployer)[proxyInitFunction](
        cNativeStakingStrategy2Impl.address, // implementation address
        addresses.mainnet.Timelock, // governance
        initData, // data for call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    // 9. Safe approve SSV token spending
    console.log(`About to safeApproveAllTokens of NativeStakingStrategy2`);
    await cNativeStakingStrategy2.connect(sDeployer).safeApproveAllTokens();

    // 10. Fetch the first Native Staking Strategy proxy
    const cNativeStakingStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategyProxy"
    );
    console.log(
      `cNativeStakingStrategyProxy ${cNativeStakingStrategyProxy.address}`
    );

    // 11. Fetch the first Fee Accumulator proxy
    const cFeeAccumulatorProxy = await ethers.getContract(
      "NativeStakingFeeAccumulatorProxy"
    );
    console.log(`cFeeAccumulatorProxy ${cFeeAccumulatorProxy.address}`);

    // 12. Deploy new implementation for the first Native Staking Strategy
    console.log(`About to deploy NativeStakingSSVStrategy implementation`);
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
      name: `Deploy a second OETH Native Staking Strategy.

Upgrade the first OETH Native Staking Strategy`,
      actions: [
        // 1. Add new strategy to vault
        {
          contract: cVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cNativeStakingStrategy2Proxy.address],
        },
        // 2. configure Harvester to support the strategy
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cNativeStakingStrategy2Proxy.address, true],
        },
        // 3. set harvester to the strategy
        {
          contract: cNativeStakingStrategy2,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // 4. configure the fuse interval
        {
          contract: cNativeStakingStrategy2,
          signature: "setFuseInterval(uint256,uint256)",
          args: [
            ethers.utils.parseEther("21.6"),
            ethers.utils.parseEther("25.6"),
          ],
        },
        // 5. set validator registrator to the Defender Relayer
        {
          contract: cNativeStakingStrategy2,
          signature: "setRegistrator(address)",
          // The Defender Relayer
          args: [addresses.mainnet.validatorRegistrator],
        },
        // 6. set staking threshold
        {
          contract: cNativeStakingStrategy2,
          signature: "setStakeETHThreshold(uint256)",
          // 16 validators before the 5/8 multisig has to call resetStakeETHTally
          args: [ethers.utils.parseEther("512")], // 16 * 32ETH
        },
        // 7. set staking monitor
        {
          contract: cNativeStakingStrategy2,
          signature: "setStakingMonitor(address)",
          // The 5/8 multisig
          args: [addresses.mainnet.Guardian],
        },
        // 8. Upgrade the first Native Staking Strategy
        {
          contract: cNativeStakingStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dNativeStakingStrategyImpl.address],
        },
      ],
    };
  }
);
