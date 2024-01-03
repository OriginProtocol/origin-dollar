const { deploymentWithGovernanceProposal } = require("../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "083_dripper_seven_day",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "42318318869999650358298082702932608052211233251042949042209002687040749779926",
  },
  async ({ ethers }) => {
    // Current contracts
    const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");
    const cOETHDripper = await ethers.getContractAt(
      "OETHDripper",
      cOETHDripperProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Shorten OETH Dripper Time\n\
      \n\
      Change the OETH dripper time down to 7 days.\n\
      \n\
      The OETH dripper's duration was set to a long 14 days last month to avoid dripping out all AURA and BAL token rewards too quickly.\
      Now that some time has passed, we can reduce the duration to a more normal size. \
      In the short term this will result in increase of funds flowing from the dripper to OETH.\
      ",
      actions: [
        {
          contract: cOETHDripper,
          signature: "setDripDuration(uint256)",
          args: [7 * 24 * 60 * 60],
        },
        {
          contract: cOETHDripper,
          signature: "collectAndRebase()",
          args: [],
        },
      ],
    };
  }
);
