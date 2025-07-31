const { deployOnBase } = require("../../utils/deploy-l2");
const { utils } = require("ethers");

module.exports = deployOnBase(
  {
    deployName: "023_update_weth_share",
  },
  async ({ ethers }) => {
    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cAMOStrategy = await ethers.getContractAt(
      "AerodromeAMOStrategy",
      cAMOStrategyProxy.address
    );

    return {
      actions: [
        {
          // 1. Set WETH share to be 1% to 15%
          contract: cAMOStrategy,
          signature: "setAllowedPoolWethShareInterval(uint256,uint256)",
          args: [
            utils.parseUnits("0.010000001", 18),
            utils.parseUnits("0.15", 18),
          ],
        },
      ],
    };
  }
);
