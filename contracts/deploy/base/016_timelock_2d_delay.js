const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "016_timelock_2d_delay",
  },
  async ({ ethers }) => {
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.base.timelock
    );

    return {
      actions: [
        {
          // 1. Update delay to 2d
          contract: cTimelock,
          signature: "updateDelay(uint256)",
          args: [2 * 24 * 60 * 60],
        },
      ],
    };
  }
);
