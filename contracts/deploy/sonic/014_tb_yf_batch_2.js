const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  createPoolBoosterSonic,
} = require("../../utils/deploy.js");

module.exports = deployOnSonic(
  {
    deployName: "014_tb_yf_batch_2",
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

    const SALT = ethers.BigNumber.from("1741943714");

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxSingle
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsSingle } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxSingle,
      pools: ["SwapX.OsGEMSxNew","SwapX.OSSWPX"],
      salt: SALT,
      type: "Single",
    });
    console.log(actionsSingle);

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Governance Actions
    // ---
    // ---------------------------------------------------------------------------------------------------------
    return {
      actions: [
        {
          // Protocol: SwapX
          // From: GEMSx/OS
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: [
            "0x9ac7F5961a452e9cD5Be5717bD2c3dF412D1c1a5"
          ],
        },
        {
          // Protocol: SwapX
          // From: SWPX/OS
          contract: cOSonic,
          signature: "undelegateYield(address)",
          args: [
            "0x9Cb484FAD38D953bc79e2a39bBc93655256F0B16"
          ],
        },
        ...actionsSingle
      ],
    };
  }
);
