const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { createPoolBoosterSonic } = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "023_pb",
  },
  async ({ ethers }) => {
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Contracts
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const cOSonic = await ethers.getContractAt(
      "OSonic",
      addresses.sonic.OSonicProxy
    );

    const cPoolBoosterFactorySwapxDouble = await ethers.getContract(
      "PoolBoosterFactorySwapxDouble_v1"
    );

    const SALT = ethers.BigNumber.from("1753365715"); // epoch as 24th Jul 2025
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxDouble
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsDouble } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxDouble,
      pools: ["SwapX.OsWs"],
      salt: SALT,
      split: oethUnits("0.7"),
      type: "Double",
    });

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Governance Actions
    // ---
    // ---------------------------------------------------------------------------------------------------------
    return {
      actions: [...actionsDouble],
    };
  }
);
