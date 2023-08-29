const axios = require("axios");
const { defaultAbiCoder, formatUnits } = require("ethers/lib/utils");

const addresses = require("./addresses");
const log = require("./logger")("utils:1inch");

const ONE_INCH_API =
  process.env.ONEINCH_API || "https://api.1inch.io/v5.0/1/swap";
const SWAP_SELECTOR = "0x12aa3caf"; // swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
const UNISWAP_SELECTOR = "0xf78dc253"; // unoswapTo(address,address,uint256,uint256,uint256[])
const UNISWAPV3_SELECTOR = "0xbc80f1a8"; // uniswapV3SwapTo(address,uint256,uint256,uint256[])

/**
 * Re-encodes the 1Inch swap data to be used by the vault's swapper.
 * The first 4 bytes are the function selector to call on 1Inch's router.
 * If calling the swap function, the next 20 bytes is the executer's address and data.
 * If calling the unoswap or uniswapV3SwapTo functions, an array of Uniswap pools are encoded.
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

    // log(`parsed tx ${JSON.stringify(swapTx)}}`);

    let encodedData;
    if (swapTx.sighash === SWAP_SELECTOR) {
      // If swap(IAggregationExecutor executor, SwapDescription calldata desc, bytes calldata permit, bytes calldata data)
      encodedData = defaultAbiCoder.encode(
        ["bytes4", "address", "bytes"],
        [swapTx.sighash, swapTx.args[0], swapTx.args[3]]
      );
    } else if (swapTx.sighash === UNISWAP_SELECTOR) {
      // If unoswapTo(address,address,uint256,uint256,uint256[])
      encodedData = defaultAbiCoder.encode(
        ["bytes4", "uint256[]"],
        [swapTx.sighash, swapTx.args[4]]
      );
    } else if (swapTx.sighash === UNISWAPV3_SELECTOR) {
      // If uniswapV3SwapTo(address,uint256,uint256,uint256[])
      encodedData = defaultAbiCoder.encode(
        ["bytes4", "uint256[]"],
        [swapTx.sighash, swapTx.args[3]]
      );
    } else {
      throw Error(`Unknown 1Inch tx signature ${swapTx.sighash}`);
    }

    // log(`encoded collateral swap data ${encodedData}`);

    return encodedData;
  } catch (err) {
    throw Error(`Failed to recode 1Inch swap data: ${err.message}`, {
      cause: err,
    });
  }
};

/**
 * Gets the tx.data in the response of 1inch's V5 swap API
 * @param vault The Origin vault contract address. eg OUSD or OETH Vaults
 * @param fromAsset The address of the asset to swap from.
 * @param toAsset The address of the asset to swap to.
 * @param fromAmount The unit amount of fromAsset to swap. eg 1.1 WETH = 1.1e18
 * @param slippage as a percentage. eg 0.5 is 0.5%
 * @param protocols The 1Inch liquidity sources as a comma separated list. eg UNISWAP_V1,UNISWAP_V2,SUSHI,CURVE,ONE_INCH_LIMIT_ORDER
 * See https://api.1inch.io/v5.0/1/liquidity-sources
 */
const getIInchSwapData = async ({
  vault,
  fromAsset,
  toAsset,
  fromAmount,
  slippage,
  protocols,
}) => {
  const swapper = await ethers.getContract("Swapper1InchV5");

  const params = {
    fromTokenAddress: fromAsset.address,
    toTokenAddress: toAsset.address,
    amount: fromAmount.toString(),
    fromAddress: swapper.address,
    destReceiver: vault.address,
    slippage: slippage ?? 0.5,
    disableEstimate: true,
    allowPartialFill: false,
    // add protocols property if it exists
    ...(protocols && { protocols }),
  };
  log("swap API params: ", params);

  try {
    const response = await axios.get(ONE_INCH_API, { params });

    if (!response.data.tx || !response.data.tx.data) {
      throw Error("response is missing tx.data");
    }

    log("swap API toTokenAmount: ", formatUnits(response.data.toTokenAmount));
    log("swap API swap paths: ", JSON.stringify(response.data.protocols));
    // log("swap API tx.data: ", response.data.tx.data);

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
  SWAP_SELECTOR,
  UNISWAP_SELECTOR,
  UNISWAPV3_SELECTOR,
};
