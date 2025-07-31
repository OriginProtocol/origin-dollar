const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployBaseAerodromeAMOStrategyImplementation,
} = require("../deployActions");

module.exports = deployOnBase(
  {
    deployName: "020_upgrade_amo",
  },
  async ({ ethers }) => {
    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cAMOStrategyImpl =
      await deployBaseAerodromeAMOStrategyImplementation();

    return {
      actions: [
        {
          // 1. Upgrade AMO
          contract: cAMOStrategyProxy,
          signature: "upgradeTo(address)",
          args: [cAMOStrategyImpl.address],
        },
      ],
    };
  }
);
