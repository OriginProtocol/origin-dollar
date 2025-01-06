const addresses = require("../../utils/addresses");
const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "021_test_deployment",
  },
  async ({ ethers }) => {
    const cTimeLock = await ethers.getContractAt(
      "ITimelockController",
      addresses.base.timeock
    );

    console.log("Min Delay", await cTimeLock.getMinDelay());

    return {
      actions: [],
    };
  }
);
