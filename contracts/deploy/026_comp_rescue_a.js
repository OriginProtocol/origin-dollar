const { deploymentWithProposal } = require("../utils/deploy");

const OLD_GOVERNOR = "0x830622BDd79CC677eE6594E20bBda5B26568b781";
const OLD_COMP_STRAT = "0xD5433168Ed0B1F7714819646606DB509D9d8EC1f";

module.exports = deploymentWithProposal(
  { deployName: "026_comp_rescue_a", forceDeploy: false },
  async ({ ethers, assetAddresses }) => {
    const cOldCompoundStrat = await ethers.getContractAt(
      "CompoundStrategy",
      OLD_COMP_STRAT
    );

    return {
      name: "Re-enable rewards collection on old Compound strategy",
      opts: { governorAddr: OLD_GOVERNOR },
      actions: [
        {
          contract: cOldCompoundStrat,
          signature: "setRewardTokenAddress(address)",
          args: [assetAddresses.COMP],
        },
      ],
    };
  }
);
