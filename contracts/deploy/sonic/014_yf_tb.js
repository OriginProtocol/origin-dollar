const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { createPoolBoosterSonic } = require("../../utils/deploy.js");

module.exports = deployOnSonic(
  {
    deployName: "014_yf_tb",
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

    const cPoolBoosterFactorySwapxSingle = await ethers.getContract(
      "PoolBoosterFactorySwapxSingle"
    );

    const SALT = ethers.BigNumber.from("1741630610"); // epoch as Monday 10th Mar 2025 6PM UTC

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxSingle
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsSingle } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxSingle,
      pools: ["SwapX.OsHOG", "SwapX.OsGHOG"],
      salt: SALT,
      type: "Single",
    });

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Governance Actions
    // ---
    // ---------------------------------------------------------------------------------------------------------
    return {
      actions: [
        {
          // Plateform: SwapX
          // Protocol: HOG
          // From: Os/HOG to --> EOA
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: [addresses.sonic.SwapX.OsHOG.pool],
        },
        {
          // Plateform: SwapX
          // Protocol: HOG
          // From: Os/GHOG to --> EOA
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: [addresses.sonic.SwapX.OsGHOG.pool],
        },
        ...actionsSingle,
      ],
    };
  }
);
