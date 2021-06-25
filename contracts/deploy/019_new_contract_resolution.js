const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "018_token_resolution_upgrade" },
  async ({ ethers, deployWithConfirmation }) => {
    // Deployments
    const dOUSD = await deployWithConfirmation("OUSD");

    // Governance
    const cOUSDProxy = await ethers.getContract("OUSDProxy");
    return {
      name: "Upgrade OUSD resolution for new contracts",
      actions: [
        {
          contract: cOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dOUSD.address],
        },
      ],
    };
  }
);
