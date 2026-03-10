const { deployOnSonic } = require("../../utils/deploy-l2");
const {
  deploySonicSwapXAMOStrategyImplementation,
} = require("../deployActions");

// This is just used to confirm that the Refactoring SwapX AMO strategy into a generalized Algebra strategy is working
// as expected. This doesn't need to be deployed on Sonic. It should stay in to not break the behavior tests.
module.exports = deployOnSonic(
  {
    deployName: "027_upgrade_swapx",
    forceSkip: false,
  },
  async ({ ethers }) => {
    const cSonicSwapXAMOStrategyProxy = await ethers.getContract(
      "SonicSwapXAMOStrategyProxy"
    );

    // Deploy Sonic SwapX AMO Strategy implementation
    const cSonicSwapXAMOImpl =
      await deploySonicSwapXAMOStrategyImplementation();

    return {
      actions: [
        // 1. Upgrade SwapX AMO Strategy
        {
          contract: cSonicSwapXAMOStrategyProxy,
          signature: "upgradeTo(address)",
          args: [cSonicSwapXAMOImpl.address],
        },
      ],
    };
  }
);
