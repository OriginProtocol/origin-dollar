const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "024_resolution_upgrade_start", forceDeploy: false },
  async ({ ethers, deployWithConfirmation }) => {
    const dOUSDResolutionUpgrade = await deployWithConfirmation(
      "OUSDResolutionUpgrade"
    );
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // Governance proposal
    return {
      name: "Switch OUSD into resolution upgrade mode",
      actions: [
        {
          contract: cOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDResolutionUpgrade.address],
        },
      ],
    };
  }
);
