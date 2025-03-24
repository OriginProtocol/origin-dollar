const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { createPoolBoosterSonic } = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "016_yf",
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

    const SALT = ethers.BigNumber.from("1742807527"); // epoch as Monday 24th Mar 2025 9PM UTC

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxDouble
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsDouble } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxDouble,
      pools: ["SwapX.OsPendle"],
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
      name: "SwapX YF: Treasury boost for Stout.Fi and PoolBooster for OS/PENDLE",
      actions: [
        {
          // Plateform: SwapX
          // Protocol: Stout.Fi
          // From STTX/OS --> To: Gnosis Safe
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x23d638084e3085ff8989745bb2e4ca8fc8591c66",
            "0x12684d18BDBA8e31936f40aBcE1175366874114f",
          ],
        },
        ...actionsDouble,
      ],
    };
  }
);
