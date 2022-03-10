const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "025_resolution_upgrade_start", forceDeploy: false },
  async ({ ethers, deployWithConfirmation }) => {
    const dOUSDImpl = await deployWithConfirmation(
      "OUSD",
      undefined,
      undefined,
      true
    );
    const cOUSDProxy = await ethers.getContract("OUSDProxy");

    // Governance proposal
    return {
      name: "Activate OUSD after resolution upgrade complete",
      actions: [
        {
          contract: cOUSDProxy,
          signature: "upgradeTo(address)",
          args: [dOUSDImpl.address],
        },
      ],
    };
  }
);
