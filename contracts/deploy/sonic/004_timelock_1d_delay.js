const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "004_timelock_1d_delay",
  },
  async ({ ethers }) => {
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.sonic.timelock
    );

    return {
      actions: [
        {
          // 1. Update delay to 1d
          contract: cTimelock,
          signature: "updateDelay(uint256)",
          args: [24 * 60 * 60],
        },
      ],
    };
  }
);
