const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "087_reduce_redeem_fee",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
    proposalId:
      "65736676478255082917578320925818351763021045059129074442773770659139360191164",
  },
  async ({ ethers }) => {
    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "OETHVault",
      cOETHVaultProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Shorten OETH Redeem Fee\n\
      \n\
      Change the OETH redemption fee down to 0.1bps.",
      actions: [
        {
          contract: cOETHVault,
          signature: "setRedeemFeeBps(uint256)",
          args: [10], // 10 == 0.1bps
        },
      ],
    };
  }
);
