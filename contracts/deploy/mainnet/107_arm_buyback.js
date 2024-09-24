const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "107_arm_buyback",
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    deployerIsProposer: false, // just to solve the issue of later active proposals failing
    proposalId: "",
  },
  async ({ deployWithConfirmation, getTxOpts, withConfirmation }) => {
    const { strategistAddr } = await getNamedAccounts();

    const cSwapper = await ethers.getContract("Swapper1InchV5");

    // Deployer Actions
    // ----------------
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // 1. Deploy new ARM Buyback proxy
    const dARMBuybackProxy = await deployWithConfirmation("ARMBuybackProxy");
    const cARMBuybackProxy = await ethers.getContract("ARMBuybackProxy");

    // 2. Deploy new ARM Buyback implementation
    const dARMBuybackImpl = await deployWithConfirmation("ARMBuyback", [
      addresses.mainnet.WETH,
      addresses.mainnet.OGN,
      addresses.mainnet.CVX,
      addresses.mainnet.CVXLocker,
    ]);
    const cARMBuyback = await ethers.getContractAt(
      "ARMBuyback",
      dARMBuybackProxy.address
    );

    // 3. Construct initialize call data to initialize and configure the new buyback
    const initData = cARMBuyback.interface.encodeFunctionData(
      "initialize(address,address,address,address,uint256)",
      [
        cSwapper.address, // Swapper1InchV5
        strategistAddr, // MS 2
        strategistAddr, // MS 2
        addresses.mainnet.OGNRewardsSource, // FixedRateRewardsSourceProxy
        0,
      ]
    );

    // 4. Init the proxy to point at the implementation and call initialize
    const initFunction = "initialize(address,address,bytes)";
    await withConfirmation(
      cARMBuybackProxy.connect(sDeployer)[initFunction](
        dARMBuybackImpl.address,
        addresses.mainnet.Timelock, // governor
        initData, // data for delegate call to the initialize function on the strategy
        await getTxOpts()
      )
    );

    return {};
  }
);
