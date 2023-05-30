const axios = require("axios");
const { defaultAbiCoder } = require("ethers/lib/utils");

const addresses = require("./addresses");

const ONE_INCH_API = "https://api.1inch.io/v5.0/1/swap";

/**
 * Re-encodes the 1Inch swap data to be used by the vault's swapper
 * @param {string} apiEncodedData tx.data from 1inch's /v5.0/1/swap API
 * @returns {string} encoded executer address and data for vault collateral swaps
 */
const recodeSwapData = async (apiEncodedData) => {
  const c1InchRouter = await ethers.getContractAt(
    "IOneInchRouter",
    addresses.mainnet.oneInchRouterV5
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

const getIInchSwapData = async ({
  vault,
  fromAsset,
  toAsset,
  fromAmount,
  slippage,
}) => {
  const swapper = await ethers.getContract("Swapper1InchV5");

  const params = {
    fromTokenAddress: fromAsset.address,
    toTokenAddress: toAsset.address,
    amount: fromAmount.toString(),
    fromAddress: swapper.address,
    destReceiver: vault.address,
    slippage: slippage ?? 1,
    disableEstimate: true,
    allowPartialFill: false,
  };

  try {
    const response = await axios.get(ONE_INCH_API, { params });

    if (!response.data.tx || !response.data.tx.data) {
      throw Error("response is missing tx.data");
    }

    return response.data.tx.data;
  } catch (err) {
    if (err.response) {
      console.error("Response data  : ", err.response.data);
      console.error("Response status: ", err.response.status);
    }
    throw Error(`Call to 1Inch swap API failed: ${err.message}`);
  }
};

module.exports = {
  recodeSwapData,
  getIInchSwapData,
};
