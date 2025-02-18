const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployWithConfirmation
} = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "009_pool_booster_factory",
  },
  async ({ ethers }) => {
    const dPoolBoosterFactory = await deployWithConfirmation(
      "PoolBoosterFactorySwapxIchi_v1",
      [addresses.sonic.OSonicProxy, addresses.sonic.timelock],
      "PoolBoosterFactorySwapxIchi"
    );
    console.log(
      `Deployed Pool Booster Ichi Factory to ${dPoolBoosterFactory.address}`
    );
    const cPoolBoosterFactory = await ethers.getContract(
      "PoolBoosterFactorySwapxIchi_v1"
    );

    return {
      actions: [
        {
          contract: cPoolBoosterFactory,
          signature:
            "createPoolBoosterSwapxIchi(address,address,address,uint256,uint256)",
          args: [
            addresses.sonic.SwapXOsUSDCe.extBribeOS,
            addresses.sonic.SwapXOsUSDCe.extBribeUSDC,
            addresses.sonic.SwapXOsUSDCe.pool,
            oethUnits("0.7"), // 70%
            ethers.BigNumber.from(`${Date.now()}`), // current time as salt
          ],
        },
      ],
    };
  }
);
