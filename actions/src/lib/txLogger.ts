import {
  type PublicClient,
  type Hash,
  type TransactionReceipt,
  formatEther,
} from "viem";
import logger from "./logger";

/**
 * Log transaction details after the tx has been sent.
 */
export async function logTxDetails(
  client: PublicClient,
  hash: Hash,
  method: string
): Promise<TransactionReceipt> {
  const tx = await client.getTransaction({ hash });
  logger.info(
    `Sent ${method} tx ${hash} from ${tx.from} (${
      tx.gasPrice ? Number(tx.gasPrice) / 1e9 : "unknown"
    } Gwei)`,
    { label: "tx" }
  );

  const receipt = await client.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Transaction ${method} failed`);
  }

  const txCost =
    receipt.gasUsed * (receipt.effectiveGasPrice ?? tx.gasPrice ?? 0n);
  logger.info(
    `Processed ${method} in block ${receipt.blockNumber}, ${receipt.gasUsed} gas, ${formatEther(txCost)} ETH`,
    { label: "tx" }
  );

  return receipt;
}
