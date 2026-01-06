const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "163_increase_oeth_redeem_fee",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    // proposalId: "",
  },
  async () => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "OETHVaultAdmin",
      cVaultProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: `Increase the OETH redeem fee from 10 to 50 basis points`,
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setRedeemFeeBps(uint256)",
          args: [50],
        },
      ],
    };
  }
);
