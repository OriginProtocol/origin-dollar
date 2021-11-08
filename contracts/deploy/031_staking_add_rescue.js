const { deploymentWithProposal } = require("../utils/deploy");

const TRANSFER_AGENT = "0x522731a061e896B5Db9dDff9234fB5461A533710";

module.exports = deploymentWithProposal(
  { deployName: "031_staking_add_rescue", forceDeploy: true },
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
