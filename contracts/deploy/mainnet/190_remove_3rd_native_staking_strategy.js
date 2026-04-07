const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "190_remove_3rd_native_staking_strategy",
    forceDeploy: false,
    // forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId:
      "2091440545333272408696406472145480985113780631375180751702560661023195300548",
  },
  async () => {
    // Current OETH Vault contracts
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "IVault",
      cVaultProxy.address
    );
    const cStrategyProxy = await ethers.getContract(
      "NativeStakingSSVStrategy3Proxy"
    );

    // Governance Actions
    // ----------------
    return {
      name: "Remove the 3rd Native Staking Strategy from the OETH Vault",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "removeStrategy(address)",
          args: [cStrategyProxy.address],
        },
      ],
    };
  }
);
