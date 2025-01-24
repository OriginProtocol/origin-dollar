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
  async ({ deployWithConfirmation }) => {
    const { multichainStrategistAddr } = await getNamedAccounts();

    // ---- Menu ---
    // 1. Deploy new simple Harvester
    // 2. Change harvester on all SSV strategies
    // 3. Support strategies on the harvester
    // 4. Sending all WETH from the OldDripper to FixedRateDripper
    // 5. Update harvester on OETH AMO
    // 6. Support AMO strategy on new harvester
    // --------------

    // 1. Deploy new simple Harvester
    const cOETHFixedRateDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );
    const dOETHHarvesterSimple = await deployWithConfirmation(
      "OETHHarvesterSimple",
      [
        addresses.mainnet.Timelock,
        multichainStrategistAddr,
        cOETHFixedRateDripperProxy.address,
        addresses.mainnet.WETH,
      ],
      undefined,
      true
    );
    const cOETHHarvesterSimple = await ethers.getContractAt(
      "OETHHarvesterSimple",
      dOETHHarvesterSimple.address
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

    // 5. Update harvester on OETH AMO
    const cAMO = await ethers.getContractAt(
      "ConvexEthMetaStrategy",
      addresses.mainnet.ConvexOETHAMOStrategy
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

        // 5. Update harvester on OETH AMO
        {
          contract: cAMO,
          signature: "setHarvesterAddress(address)",
          args: [cOETHHarvesterSimple.address],
        },

        // 6. Support AMO strategy on new harvester
        {
          contract: cOETHHarvesterSimple,
          signature: "setSupportedStrategy(address,bool)",
          args: [cAMO.address, true],
        },
      ],
    };
  }
);
