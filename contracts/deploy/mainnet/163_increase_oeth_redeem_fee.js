const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "163_increase_oeth_redeem_fee",
    forceDeploy: false,
    // forceSkip: true,
    // reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "114762529796512226318240295500903888662758332295622344488561410551668255383581",
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
      name: `Increase the OETH redeem fee from 0.1% to 10%.\nThis is to prevent MEV bots taking WETH from the Vault after ETH from exited validators have been swept and accounted for.`,
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
