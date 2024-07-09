const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "101_dripper_fourteen_day",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    // proposalId:
    //  "107146116537515525680409743691006652841112781786145428928245504968702148742130",
  },
  async ({ ethers }) => {
    // Current contracts
    const cOETHDripperProxy = await ethers.getContract("OETHDripperProxy");
    const cOETHDripper = await ethers.getContractAt(
      "OETHDripper",
      cOETHDripperProxy.address
    );
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "OETHVaultCore",
      cOETHVaultProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Increase OETH Dripper Time\n\
      \n\
      Change the OETH dripper time from 7 to 14 days.\n\
      \n\
      The OETH dripper's duration was set to 7 days last January to increase flow of funds from the dripper to OETH.\
      However, to adapt to the beacon chain sweep delay (approx 9 days), we can increase the duration to match beacon chain specification.\
      ",
      actions: [
        {
          contract: cOETHDripper,
          signature: "setDripDuration(uint256)",
          args: [14 * 24 * 60 * 60],
        },
        {
          contract: cOETHVault,
          signature: "rebase()",
          args: [],
        },
      ],
    };
  }
);
