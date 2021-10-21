const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "024_resolution_upgrade_start", forceDeploy: false },
  async ({ ethers, deployWithConfirmation }) => {
    console.log("💠💠💠🐱");
    const dOUSDResolutionUpgrade = await deployWithConfirmation(
      "OUSDResolutionUpgrade"
    );
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // New OUSD
    const dOUSDImpl = await deployWithConfirmation(
      "OUSD",
      undefined,
      undefined,
      true
    );

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
