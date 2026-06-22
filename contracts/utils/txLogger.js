const { BigNumber } = require("ethers");
const { formatUnits } = require("ethers/lib/utils");

const log = require("./logger")("utils:txLogger");

/**
 * Log transaction details after the tx has been sent and mined.
 * @param {ContractTransaction} tx transaction sent to the network
 * @param {string} method description of the tx. eg method name
 * @returns {ContractReceipt} transaction receipt
 */
async function logTxDetails(tx, method) {
  const submittedGasPrice =
    tx.gasPrice ?? tx.maxFeePerGas ?? tx.maxPriorityFeePerGas;
  const submittedGasPriceGwei = submittedGasPrice
    ? formatUnits(submittedGasPrice, "gwei")
    : "n/a";

  log(
    `Sent ${method} transaction with hash ${tx.hash} from ${tx.from} with gas price ${submittedGasPriceGwei} Gwei`
  );
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`Transaction ${method} failed`);
  }

  const effectiveGasPrice =
    receipt.effectiveGasPrice ??
    tx.gasPrice ??
    tx.maxFeePerGas ??
    BigNumber.from(0);

  // Calculate tx cost in Wei
  const txCost = receipt.gasUsed.mul(effectiveGasPrice);
  log(
    `Processed ${method} tx in block ${receipt.blockNumber}, using ${
      receipt.gasUsed
    } gas costing ${formatUnits(txCost)} ETH`
  );

  return receipt;
}

module.exports = {
  logTxDetails,
};
