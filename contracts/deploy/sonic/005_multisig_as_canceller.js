const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "005_multisig_as_canceller",
  },
  async ({ ethers }) => {
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.sonic.timelock
    );

    const timelockCancellerRole = await cTimelock.CANCELLER_ROLE();

    return {
      actions: [
        {
          // 1. Grant canceller role to 5/8 Multisig
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [timelockCancellerRole, addresses.sonic.admin],
        },
      ],
    };
  }
);
