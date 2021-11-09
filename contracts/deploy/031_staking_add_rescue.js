const { deploymentWithProposal } = require("../utils/deploy");

const TRANSFER_AGENT = "0x449E0B5564e0d141b3bc3829E74fFA0Ea8C08ad5";

module.exports = deploymentWithProposal(
  { deployName: "031_staking_add_rescue", forceDeploy: false },
  async ({ ethers, deployWithConfirmation }) => {
    // Deploy new staking contract
    const dSingleAssetStaking = await deployWithConfirmation(
      "SingleAssetStaking"
    );

    // Contracts for Governance actions
    const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");
    const cSingleAssetStaking = await ethers.getContractAt(
      "SingleAssetStaking",
      cOGNStakingProxy.address
    );

    // Governance
    return {
      name: "Start moving OGN staking to new governor",
      actions: [
        {
          contract: cOGNStakingProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          contract: cOGNStakingProxy,
          signature: "upgradeTo(address)",
          args: [dSingleAssetStaking.address],
        },
        {
          contract: cSingleAssetStaking,
          signature: "setTransferAgent(address)",
          args: [TRANSFER_AGENT],
        },
      ],
    };
  }
);
