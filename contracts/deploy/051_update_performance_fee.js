const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  {
    deployName: "051_update_performance_fee",
    forceDeploy: false,
    forceSkip: true,
  },
  async ({ ethers }) => {
    // Vault contract
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Increase performance fee to 20%",
      actions: [
        {
          contract: cVaultAdmin,
          signature: "setTrusteeFeeBps(uint256)",
          args: ["2000"], // 20%
        },
      ],
    };
  }
);
