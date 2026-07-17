import {
  encodeFunctionData,
  formatEther,
  formatGwei,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
} from "viem";
import {
  createDb,
  createPool,
  sendQueuedTransaction,
  type Db,
} from "@talos/client";
import type { Logger } from "./viemAction";

// Lazily-created singleton nonce-queue DB. Only engaged when DATABASE_URL is
// set — same invariant as the old `utils/signers.js#maybeWrap`.
let dbInstance: Db | null = null;
function getNonceDb(): Db | null {
  if (!process.env.DATABASE_URL) return null;
  if (!dbInstance) {
    const pool = createPool({ connectionString: process.env.DATABASE_URL });
    dbInstance = createDb(pool);
  }
  return dbInstance;
}

export interface TxRequest {
  to: Address;
  data?: Hex;
  value?: bigint;
  gas?: bigint;
}

export interface SendResult {
  hash: Hex;
  receipt?: TransactionReceipt;
}

export type SendTx = (tx: TxRequest, label: string) => Promise<SendResult>;

export type WriteContract = (
  contract: { address: Address; abi: Abi },
  functionName: string,
  args: unknown[],
  label: string,
  opts?: { gas?: bigint; value?: bigint }
) => Promise<SendResult>;

function logReceipt(
  log: Logger,
  label: string,
  hash: Hex,
  receipt?: TransactionReceipt
): void {
  if (!receipt) {
    log.info(`${label}: sent ${hash}`);
    return;
  }
  const fee =
    receipt.effectiveGasPrice != null
      ? ` fee=${formatEther(receipt.gasUsed * receipt.effectiveGasPrice)} ETH` +
        ` @ ${formatGwei(receipt.effectiveGasPrice)} gwei`
      : "";
  log.info(
    `${label}: ${receipt.status} ${hash} (block ${receipt.blockNumber}, ` +
      `gas ${receipt.gasUsed}${fee})`
  );
}

/**
 * Build the action's `sendTx`. Routes through the Talos viem nonce queue when
 * DATABASE_URL is set, else does a plain send + wait. Either way the account +
 * chain come from the walletClient.
 */
export function makeSendTx(
  walletClient: WalletClient,
  publicClient: PublicClient,
  log: Logger
): SendTx {
  return async (tx, label) => {
    const db = getNonceDb();
    if (db) {
      const res = await sendQueuedTransaction(walletClient, tx as never, {
        db,
        publicClient,
        log,
      });
      logReceipt(log, label, res.hash, res.receipt);
      return res;
    }
    const hash = await walletClient.sendTransaction({
      ...tx,
      account: walletClient.account ?? null,
      chain: walletClient.chain ?? null,
    } as never);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`Transaction ${label} reverted (${hash})`);
    }
    logReceipt(log, label, hash, receipt);
    return { hash, receipt };
  };
}

/**
 * Convenience wrapper so every contract write flows through the single `sendTx`
 * path (and thus the nonce queue): encode calldata then send `{ to, data }`.
 */
export function makeWriteContract(sendTx: SendTx): WriteContract {
  return (contract, functionName, args, label, opts) => {
    const data = encodeFunctionData({
      abi: contract.abi,
      functionName,
      args,
    });
    return sendTx(
      { to: contract.address, data, gas: opts?.gas, value: opts?.value },
      label
    );
  };
}
