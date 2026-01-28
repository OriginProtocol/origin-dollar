const { deployOnPlume } = require("../../utils/deploy-l2");

module.exports = deployOnPlume(
  {
    deployName: "011_reduce_withdrawal_time",
    //proposalId: "",
  },
  async ({ ethers }) => {
    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");
    const cOETHpVault = await ethers.getContractAt("IVault", cOETHpVaultProxy.address);

    // ----------------
    // Governance Actions
    // ----------------
    return {
      name: "Reduce withdrawal time to 10 minutes",
      actions: [
        // 1. Upgrade VaultCore implementation
        {
          contract: cOETHpVault,
          signature: "setWithdrawalClaimDelay(uint256)",
          args: [10 * 60], // 10 mins
        },
      ],
    };
  }
);
