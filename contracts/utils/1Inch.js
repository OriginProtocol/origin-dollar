const axios = require("axios");
const { defaultAbiCoder } = require("ethers/lib/utils");

const addresses = require("./addresses");
const log = require("./logger")("utils:1inch");

const ONE_INCH_API = "https://api.1inch.io/v5.0/1/swap";

/**
 * Re-encodes the 1Inch swap data to be used by the vault's swapper.
 * The first 4 bytes are the function selector to call on 1Inch's router.
 * If calling the swap function, the next 20 bytes is the executer's address and data.
 * If calling the uniswapV3SwapTo function, an array of Uniswap V3 pools are encoded.
 * @param {string} apiEncodedData tx.data from 1inch's /v5.0/1/swap API
 * @returns {string} RLP encoded data for the Vault's `swapCollateral` function
 */
const recodeSwapData = async (apiEncodedData) => {
  try {
    const c1InchRouter = await ethers.getContractAt(
      "IOneInchRouter",
      addresses.mainnet.oneInchRouterV5
    );

    // decode the 1Inch tx.data that is RLP encoded
    const swapTx = c1InchRouter.interface.parseTransaction({
      data: apiEncodedData,
    });

    let encodedData;
    if (swapTx.sighash === "0x12aa3caf") {
      // If swap(IAggregationExecutor executor, SwapDescription calldata desc, bytes calldata permit, bytes calldata data)
      encodedData = defaultAbiCoder.encode(
        ["bytes4", "address", "bytes"],
        [swapTx.sighash, swapTx.args[0], swapTx.args[3]]
      );
    } else if (swapTx.sighash === "0xbc80f1a8") {
      // If uniswapV3SwapTo(address payable recipient, uint256 amount, uint256 minReturn, uint256[] calldata pools)
      encodedData = defaultAbiCoder.encode(
        ["bytes4", "uint256[]"],
        [swapTx.sighash, swapTx.args[3]]
      );
    } else {
      throw Error(`Unknown 1Inch tx signature ${swapTx.sighash}`);
    }

    log(`encoded collateral swap data ${encodedData}`);

    return encodedData;
  } catch (err) {
    throw Error(`Failed to recode 1Inch swap data: ${err.message}`);
  }
};

/**
 * Gets the tx.data in the response of 1inch's V5 swap API
 */
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
  log("swap API params: ", params);

  try {
    const response = await axios.get(ONE_INCH_API, { params });

    if (!response.data.tx || !response.data.tx.data) {
      throw Error("response is missing tx.data");
    }

    log("swap API tx.data: ", response.data.tx.data);

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
