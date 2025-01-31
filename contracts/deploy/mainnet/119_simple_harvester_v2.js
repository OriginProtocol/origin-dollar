const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "119_simple_harvester_v2",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ deployWithConfirmation, withConfirmation }) => {
    const { multichainStrategistAddr, deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // ---- Menu ---
    // 1. Deploy new simple Harvester
    // 2. Change harvester on all SSV strategies
    // 3. Support strategies on the harvester
    // 4. Sending all WETH from the OldDripper to FixedRateDripper
    // --------------

    // 1. Deploy new simple Harvester
    const cOETHFixedRateDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );

    // 1.a Deploy proxy
    const dOETHSimpleHarvesterProxy = await deployWithConfirmation(
      "OETHSimpleHarvesterProxy"
    );

    const cOETHSimpleHarvesterProxy = await ethers.getContractAt(
      "OETHSimpleHarvesterProxy",
      dOETHSimpleHarvesterProxy.address
    );

    // 1.b Deploy implementation
    const dOETHHarvesterSimpleImpl = await deployWithConfirmation(
      "OETHHarvesterSimple",
      [addresses.mainnet.WETH],
      undefined,
      true
    );

    const cOETHHarvesterSimpleImpl = await ethers.getContractAt(
      "OETHHarvesterSimple",
      dOETHHarvesterSimpleImpl.address
    );

    // 1.c Initialize the proxy
    const initData = cOETHHarvesterSimpleImpl.interface.encodeFunctionData(
      "initialize(address,address,address)",
      [
        addresses.mainnet.Timelock,
        multichainStrategistAddr,
        cOETHFixedRateDripperProxy.address,
      ]
    );

    const proxyInitFunction = "initialize(address,address,bytes)";
    // prettier-ignore
    await withConfirmation(
      cOETHSimpleHarvesterProxy.connect(sDeployer)[proxyInitFunction](
          cOETHHarvesterSimpleImpl.address,
          addresses.mainnet.Timelock,
          initData
        )
    );

    const cOETHHarvesterSimple = await ethers.getContractAt(
      "OETHHarvesterSimple",
      dOETHSimpleHarvesterProxy.address
    );

    // 2. Change harvester on all SSV strategies
    const cNativeStakingStrategyProxy_1 = await ethers.getContract(
      "NativeStakingSSVStrategyProxy"
    );
    const cNativeStakingStrategy_1 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategyProxy_1.address
    );

    const cNativeStakingStrategyProxy_2 = await ethers.getContract(
      "NativeStakingSSVStrategy2Proxy"
    );
    const cNativeStakingStrategy_2 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategyProxy_2.address
    );

    const cNativeStakingStrategyProxy_3 = await ethers.getContract(
      "NativeStakingSSVStrategy3Proxy"
    );
    const cNativeStakingStrategy_3 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      cNativeStakingStrategyProxy_3.address
    );

    // 4. Sending all WETH from the OldDripper to FixedRateDripper
    const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");

    console.log("Old dripper address: ", cOETHDripperProxy.address);

    const cOETHDripper = await ethers.getContractAt(
      "OETHDripper",
      cOETHDripperProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Todo",
      actions: [
        // 2. Change harvester on all SSV strategies
        {
          contract: cNativeStakingStrategy_1,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvesterSimple.address],
        },
        {
          contract: cNativeStakingStrategy_2,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvesterSimple.address],
        },
        {
          contract: cNativeStakingStrategy_3,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvesterSimple.address],
        },

        // 3. Support strategies on the harvester
        {
          contract: cOETHHarvesterSimple,
          signature: "setSupportedStrategy(address,bool)",
          args: [cNativeStakingStrategy_1.address, true],
        },
        {
          contract: cOETHHarvesterSimple,
          signature: "setSupportedStrategy(address,bool)",
          args: [cNativeStakingStrategy_2.address, true],
        },
        {
          contract: cOETHHarvesterSimple,
          signature: "setSupportedStrategy(address,bool)",
          args: [cNativeStakingStrategy_3.address, true],
        },

        // 4. Sending all WETH from the OldDripper to FixedRateDripper
        {
          contract: cOETHDripper,
          signature: "transferAllToken(address,address)",
          args: [addresses.mainnet.WETH, cOETHFixedRateDripperProxy.address],
        },
      ],
    };
  }
);
