import {
  type PublicClient,
  type Hash,
  type TransactionReceipt,
  formatEther,
} from "viem";
import type { Logger } from "winston";

/**
 * Log transaction details after the tx has been sent.
 */
export async function logTxDetails(
  client: PublicClient,
  hash: Hash,
  method: string,
  log: Logger
): Promise<TransactionReceipt> {
  const tx = await client.getTransaction({ hash });
  log.info(
    `Sent ${method} tx ${hash} from ${tx.from} (${
      tx.gasPrice ? Number(tx.gasPrice) / 1e9 : "unknown"
    } Gwei)`
  );

  const receipt = await client.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`Transaction ${method} failed`);
  }

  const txCost =
    receipt.gasUsed * (receipt.effectiveGasPrice ?? tx.gasPrice ?? 0n);
  log.info(
    `Processed ${method} in block ${receipt.blockNumber}, ${receipt.gasUsed} gas, ${formatEther(txCost)} ETH`
  );

  return receipt;
}
