const {
  OrderKind,
  OrderBookApi,
  SupportedChainId,
} = require("@cowprotocol/cow-sdk");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const { getSigner } = require("../utils/signers");
const { resolveAsset } = require("../utils/assets");

const log = require("../utils/logger")("task:cow");

/**
 * Hardhat task to dump the current state of a Curve Metapool pool used for AMO
 */
async function cowQuoteTask(taskArguments) {
  const { amount, sell, buy } = taskArguments;

  const sellAsset = await resolveAsset(sell);
  const buyAsset = await resolveAsset(buy);
  const amountBN = parseUnits(amount.toString(), await sellAsset.decimals());

  const signer = await getSigner();

  const orderBookApi = new OrderBookApi({ chainId: SupportedChainId.MAINNET });

  log(
    `About to get quote to swap ${amount} ${sell} for ${buy} from account ${await signer.getAddress()}`
  );

  const quoteResponse = await orderBookApi.getQuote({
    kind: OrderKind.SELL,
    sellToken: sellAsset.address,
    buyToken: buyAsset.address,
    sellAmountBeforeFee: amountBN.toString(),
    from: await signer.getAddress(),
  });

  const { buyAmount, feeAmount } = quoteResponse.quote;

  console.log(`Sell: ${amount} ${sell}`);
  console.log(
    `Buy : ${formatUnits(buyAmount, await buyAsset.decimals())} ${buy}`
  );
  console.log(
    `Fee : ${formatUnits(feeAmount, await buyAsset.decimals())} ${sell}`
  );
}

module.exports = {
  cowQuoteTask,
};
