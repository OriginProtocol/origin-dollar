const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "019_resolution_and_savings" },
  async ({ ethers, deployWithConfirmation }) => {
    // Deployments
    const dOUSD = await deployWithConfirmation("OUSD");
    const dVaultCore = await deployWithConfirmation("VaultCore");

    // Governance proposal
    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    const cVaultProxy = await ethers.getContract("VaultProxy");
    return {
      name: "Upgrade OUSD resolution for new contracts, redeem gas savings",
      actions: [
        {
          contract: cOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dOUSD.address],
        },
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
      ],
    };
  }
);
