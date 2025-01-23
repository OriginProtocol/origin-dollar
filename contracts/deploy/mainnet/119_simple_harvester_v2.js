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
    const { strategistAddr } = await getNamedAccounts();

    // ---- Menu ---
    // 1. Deploy new simple Harvester
    // 2. Change harvester on all SSV strategies
    // 3. Support strategies on the harvester
    // 4. Sending all WETH from the OldDripper to FixedRateDripper
    // 5. Update harvester on OETH AMO
    // --------------

    // 1. Deploy new simple Harvester
    const cOETHFixedRateDripperProxy = await ethers.getContract(
      "OETHFixedRateDripperProxy"
    );
    const dOETHHarvesterSimple = await deployWithConfirmation(
      "OETHHarvesterSimple",
      [
        addresses.mainnet.Timelock,
        strategistAddr,
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
    const cNativeStakingStrategy_1 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      "0x34eDb2ee25751eE67F68A45813B22811687C0238"
    );

    const cNativeStakingStrategy_2 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      "0x4685dB8bF2Df743c861d71E6cFb5347222992076"
    );

    const cNativeStakingStrategy_3 = await ethers.getContractAt(
      "NativeStakingSSVStrategy",
      "0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63"
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
      ],
    };
  }
);
