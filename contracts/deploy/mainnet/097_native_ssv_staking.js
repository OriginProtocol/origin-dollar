const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../test/helpers.js");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "097_native_ssv_staking",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId:
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

    // 1. Fetch the strategy proxy deployed by relayer
    const cStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategyProxy"
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
    const dStrategyImpl = await deployWithConfirmation(
      "NativeStakingSSVStrategy",
      [
        [addresses.zero, cVaultProxy.address], //_baseConfig
        addresses.mainnet.WETH, // wethAddress
        addresses.mainnet.SSV, // ssvToken
        addresses.mainnet.SSVNetwork, // ssvNetwork
        dFeeAccumulatorProxy.address, // feeAccumulator
        addresses.mainnet.beaconChainDepositContract, // beacon chain deposit contract
      ]
    );
    const cStrategyImpl = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      dStrategyImpl.address
    );

    const cStrategy = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cStrategyProxy.address
    );

    // 3. Initialize Proxy with new implementation and strategy initialization
    const initData = cStrategyImpl.interface.encodeFunctionData(
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

    if (isFork) {
      const relayerSigner = await impersonateAndFund(
        addresses.mainnet.validatorRegistrator,
        "100"
      );
      await withConfirmation(
        cStrategyProxy
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
      new Error("Transfer governance not yet ran");
    }

    await withConfirmation(
      cStrategyProxy.connect(sDeployer).claimGovernance(await getTxOpts())
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

    // 8. Deploy Harvester
    const cOETHHarvesterProxy = await ethers.getContract("OETHHarvesterProxy");
    await deployWithConfirmation("OETHHarvester", [
      cVaultProxy.address,
      addresses.mainnet.WETH,
    ]);
    const dOETHHarvesterImpl = await ethers.getContract("OETHHarvester");

    console.log("Native Staking SSV Strategy proxy: ", cStrategyProxy.address);
    console.log(
      "Native Staking SSV Strategy implementation: ",
      dStrategyImpl.address
    );
    console.log("Fee accumulator proxy: ", cFeeAccumulatorProxy.address);
    console.log("Fee accumulator implementation: ", cFeeAccumulator.address);
    console.log(
      "New OETHHarvester implementation: ",
      dOETHHarvesterImpl.address
    );

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
        // 2. configure Harvester to support the strategy
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cStrategyProxy.address, true],
        },
        // 3. set harvester to the strategy
        {
          contract: cStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
        // 4. configure the fuse interval
        {
          contract: cStrategy,
          signature: "setFuseInterval(uint256,uint256)",
          args: [
            ethers.utils.parseEther("21.6"),
            ethers.utils.parseEther("25.6"),
          ],
        },
        // 5. set validator registrator
        {
          contract: cStrategy,
          signature: "setRegistrator(address)",
          args: [addresses.mainnet.validatorRegistrator],
        },
        // 6. set staking threshold
        {
          contract: cStrategy,
          signature: "setStakeETHThreshold(uint256)",
          // TODO: confirm this number makes sense
          args: [ethers.utils.parseEther("32")], // 32ETH * 32
        },
        // 7. set staking monitor
        {
          contract: cStrategy,
          signature: "setStakingMonitor(address)",
          args: [addresses.mainnet.Guardian], // 32ETH * 32
        },
        // 8. Upgrade the OETH Harvester
        {
          contract: cOETHHarvesterProxy,
          signature: "upgradeTo(address)",
          args: [dOETHHarvesterImpl.address],
        },
      ],
    };
  }
);
