const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "163_increase_oeth_redeem_fee",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "74087219166026533236211044968704800558008230594792107684752001539143606662996",
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
      name: `Increase the OETH redeem fee from 0.1% to 10%. This is to prevent MEV bots taking WETH from the Vault after ETH from exited validators have been swept and accounted for.`,
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setRedeemFeeBps(uint256)",
          args: [1000],
        },
      ],
    };
  }
);
