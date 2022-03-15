const { deploymentWithProposal, log } = require("../utils/deploy");

// Deploy new staking implimentation contract with fix
// Upgrade to using it

module.exports = deploymentWithProposal(
  { deployName: "038_staking_patch", forceDeploy: false },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy the new implementation.
    const dSingleAssetStaking = await deployWithConfirmation(
      "SingleAssetStaking"
    );

    // Governance Actions
    // ----------------

    return {
      name: "Upgrade Staking",
      actions: [
        // 1. Upgrade
        {
          contract: cOGNStakingProxy,
          signature: "upgradeTo(address)",
          args: [dSingleAssetStaking.address],
        },
      ],
    };
  }
);
