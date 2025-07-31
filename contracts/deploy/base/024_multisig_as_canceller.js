const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

module.exports = deployOnBase(
  {
    deployName: "024_multisig_as_canceller",
  },
  async ({ ethers }) => {
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.base.timelock
    );

    const timelockCancellerRole = await cTimelock.CANCELLER_ROLE();

    return {
      name: "Grant canceller role to 5/8 Multisig",
      actions: [
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [timelockCancellerRole, addresses.base.governor],
        },
      ],
    };
  }
);
