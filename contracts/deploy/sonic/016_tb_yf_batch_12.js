const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { createPoolBoosterSonic } = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "016_tb_yf_batch_12",
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

    const cPoolBoosterFactorySwapxSingle = await ethers.getContract(
      "PoolBoosterFactorySwapxSingle"
    );

    const SALT = ethers.BigNumber.from("1743442953");

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxSingle
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsSingle } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxSingle,
      pools: ["SwapX.OsOGN", "SwapX.OsSWPx"],
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
      pools: ["SwapX.OsGoglz"],
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
      actions: [
        {
          // Plateform: SwapX
          // Protocol: SwapX
          // From: VolatileV1 AMM - SWPx/OS
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: ["0x9cb484fad38d953bc79e2a39bbc93655256f0b16"],
        },
        {
          // Plateform: SwapX
          // Protocol: THC
          // From: VolatileV1 AMM - THC/OS
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: ["0xd6f5d565410c536e3e9C4FCf05560518C2C56440"],
        },
        {
          // Plateform: SwapX
          // Protocol: EGGS
          // From: VolatileV1 AMM - EGGS/OS
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: ["0x6feae13b486a225fb2247ccfda40bf8f1dd9d4b1"],
        },
        {
          // Plateform: Shadow
          // Protocol: EGGS
          // From: EGGS/OS --> To: EGGS trasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0xe71914eb43f7e20b98406f059555ca24854d9769",
            "0x98Fc4CE3dFf1d0D7c9dF94f7d9b4E6E6468D5EfF",
          ],
        },
        {
          // Protocol: ROME
          // From: ROME/OS --> To: FSSN treasury
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x87853fB64E2405dA5136024E890BE257C9f825df",
            "0x0fF0d7FBe68A413F31484921A9B37b6A368093Bc",
          ],
        },
        ...actionsSingle,
        ...actionsDouble,
      ],
    };
  }
);
