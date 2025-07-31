const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

const EXECUTOR_ROLE =
  "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63";

module.exports = deployOnBase(
  {
    deployName: "018_strategist_as_executor",
  },
  async ({ ethers }) => {
    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.base.timelock
    );

    return {
      actions: [
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [EXECUTOR_ROLE, addresses.base.strategist],
        },
      ],
    };
  }
);
