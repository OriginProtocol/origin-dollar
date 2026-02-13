const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "174_ousd_enable_async_withdraw",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "80837757447669692892403190167850973826061122692899866950563027606125775267397",
  },
  async () => {
    // 1. Connect to the OUSD Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);

    return {
      name: "Enable async withdraws for OUSD",
      actions: [
        // 1. Enable async withdraws in the vault
        {
          contract: cVault,
          signature: "setWithdrawalClaimDelay(uint256)",
          args: [600], // 10 minutes
        },
      ],
    };
  }
);
