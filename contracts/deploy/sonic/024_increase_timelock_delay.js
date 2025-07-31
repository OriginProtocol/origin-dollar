const addresses = require("../../utils/addresses.js");
const { deployOnSonic } = require("../../utils/deploy-l2.js");

module.exports = deployOnSonic(
  {
    deployName: "024_increase_timelock_delay",
    forceSkip: false,
  },
  async ({ ethers }) => {
    // 1. Deploy new OS implementation
    const cARMProxy = await ethers.getContractAt(
      ["function setOwner(address) external"],
      "0x2F872623d1E1Af5835b08b0E49aAd2d81d649D30"
    );
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.sonic.timelock
    );

    console.log("ARM Proxy:", cARMProxy.address);
    console.log("Timelock:", cTimelock.address);

    return {
      name: "Upgrade OS token contract",
      actions: [
        // 1. Upgrade the OSonic proxy to the new implementation
        //{
        //  contract: cARMProxy,
        //  signature: "setOwner(address)",
        //  args: [addresses.sonic.timelock],
        //},
        // 2. Update delay to 2d
        {
          contract: cTimelock,
          signature: "updateDelay(uint256)",
          args: [24 * 60 * 60 * 2],
        },
      ],
    };
  }
);
