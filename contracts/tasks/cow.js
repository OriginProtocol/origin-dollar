const {
  OrderKind,
  OrderBookApi,
  SupportedChainId,
} = require("@cowprotocol/cow-sdk");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { getSigner } = require("../utils/signers");
const { resolveAsset } = require("../utils/assets");
const addresses = require("../utils/addresses");

const log = require("../utils/logger")("task:cow");

/**
 * Hardhat task to get a CoW quote for swapping assets.
 */
async function cowQuoteTask(taskArguments) {
  const { amount, sell, buy } = taskArguments;

  const sellSymbol = sell === "WOETH" ? "OETH" : sell;
  const sellAsset = await resolveAsset(sellSymbol);
  const buyAsset = await resolveAsset(buy);
  const sellAmount = parseUnits(amount.toString(), await sellAsset.decimals());

  const signer = await getSigner();

  const orderBookApi = new OrderBookApi({ chainId: SupportedChainId.MAINNET });

  log(
    `About to get quote to swap ${amount} ${sell} for ${buy} from account ${await signer.getAddress()}`
  );

  let appData;
  if (sell === "WOETH") {
    // pre swap hook to redeem OETH from wOETH
    const wOETH = await ethers.getContractAt("WOETH", addresses.mainnet.WETH);
    const callData = wOETH.interface.encodeFunctionData(
      "redeem(uint256,address,address)",
      [
        sellAmount,
        addresses.mainnet.HooksTrampoline,
        addresses.mainnet.HooksTrampoline,
      ]
    );
    log(`Redeem calldata ${callData.toString()}`);
    const gasEstimate = await wOETH.estimateGas.redeem(
      sellAmount,
      addresses.mainnet.HooksTrampoline,
      addresses.mainnet.HooksTrampoline
    );
    log(`Estimate redeem gas usage of ${gasEstimate.toString()}`);
    const redeemHook = {
      target: wOETH.address,
      callData,
      gasLimit: gasEstimate.toString(),
    };
    log(redeemHook);
    appData = JSON.stringify({
      metadata: {
        hooks: {
          pre: [redeemHook],
        },
      },
    });
    log(appData);
  }

  const quoteResponse = await orderBookApi.getQuote({
    kind: OrderKind.SELL,
    sellToken: sellAsset.address,
    buyToken: buyAsset.address,
    sellAmountBeforeFee: sellAmount.toString(),
    from: await signer.getAddress(),
    appData,
  });

  const { buyAmount, feeAmount } = quoteResponse.quote;

  console.log(`Sell: ${amount} ${sell}`);
  console.log(
    `Buy : ${formatUnits(buyAmount, await buyAsset.decimals())} ${buy}`
  );
  console.log(
    `Fee : ${formatUnits(feeAmount, await sellAsset.decimals())} ${sell}`
  );
}

module.exports = {
  cowQuoteTask,
};
