const addresses = require("../../utils/addresses.js");
const { deployOnSonic } = require("../../utils/deploy-l2.js");

module.exports = deployOnSonic(
  {
    deployName: "024_increase_timelock_delay",
    forceSkip: false,
  },
  async ({ ethers }) => {
    // 1. Deploy new OS implementation
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.sonic.timelock
    );

    return {
      name: "Upgrade OS token contract",
      actions: [
        // 1. Update delay to 2d
        {
          contract: cTimelock,
          signature: "updateDelay(uint256)",
          args: [24 * 60 * 60 * 2],
        },
      ],
    };
  }
);
