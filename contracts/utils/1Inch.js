const { defaultAbiCoder } = require("ethers/lib/utils");

/**
 * Re-encodes the 1Inch swap data to be used by the vault's swapper
 * @param {string} apiEncodedData tx.data from 1inch's /v5.0/1/swap API
 * @returns {string} encoded executer address and data for vault collateral swaps
 */
const recodeSwapData = async (apiEncodedData) => {
  const c1InchRouter = await ethers.getContractAt(
    "IOneInchRouter",
    "0x1111111254EEB25477B68fb85Ed929f73A960582"
  );
  const apiDecodedData = await c1InchRouter.interface.decodeFunctionData(
    "swap",
    apiEncodedData
  );

  return defaultAbiCoder.encode(
    ["address", "bytes"],
    [apiDecodedData.executor, apiDecodedData.data]
  );
};

module.exports = {
  recodeSwapData,
};
