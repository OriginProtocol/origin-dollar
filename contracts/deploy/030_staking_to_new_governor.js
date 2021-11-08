const { deploymentWithProposal } = require("../utils/deploy");

const OLD_GOVERNOR = "0x830622BDd79CC677eE6594E20bBda5B26568b781";
const NEW_GOVERNOR = "0x72426BA137DEC62657306b12B1E869d43FeC6eC7";

module.exports = deploymentWithProposal(
  { deployName: "030_staking_to_new_governor", forceDeploy: false },
  async ({ ethers }) => {
    const cOGNStakingProxy = await ethers.getContract("OGNStakingProxy");

    return {
      name: "OGN staking transfer to new governor",
      opts: { governorAddr: OLD_GOVERNOR },
      actions: [
        {
          contract: cOGNStakingProxy,
          signature: "transferGovernance(address)",
          args: [NEW_GOVERNOR],
        },
      ],
    };
  }
);
