const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { createPoolBoosterSonic } = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "018_pool_booster_batch",
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

    const SALT = ethers.BigNumber.from("1744352622");

    const cPoolBoosterFactorySwapxSingle = await ethers.getContract(
      "PoolBoosterFactorySwapxSingle"
    );

    const cPoolBoosterFactorySwapxDouble = await ethers.getContract(
      "PoolBoosterFactorySwapxDouble_v1"
    );

    const cPoolBoosterFactoryMetropolis = await ethers.getContract(
      "PoolBoosterFactoryMetropolis"
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxSingle
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsSingle } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxSingle,
      pools: ["SwapX.OsMYRD"],
      salt: SALT,
      type: "Single",
    });

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxDouble
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsDouble } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxDouble,
      pools: ["SwapX.OsBes", "SwapX.OsBRNx"],
      salt: SALT,
      split: oethUnits("0.7"),
      type: "Double",
    });

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster Metropolis
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsMetropolis } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactoryMetropolis,
      pools: ["Metropolis.OsWs"],
      salt: SALT,
      type: "Metropolis",
    });

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Governance Actions
    // ---
    // ---------------------------------------------------------------------------------------------------------
    return {
      actions: [...actionsSingle, ...actionsDouble, ...actionsMetropolis],
    };
  }
);
