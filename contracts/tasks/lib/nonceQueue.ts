import type { Pool, PoolClient } from "pg";
import type { ethers } from "ethers";
import {
  isNonceMismatchError,
  recoverNonceFromChain,
  submitNonceQueuedTransaction,
} from "./nonceQueueTxLifecycle";
import { recordNonceQueueTxLifecycleEvent } from "./nonceQueueTxHistory";

const log = require("../../utils/logger")("utils:nonceQueue");

let pool: Pool | null = null;
let tableEnsurePromise: Promise<void> | null = null;

function getNonceQueueLockTimeoutSeconds(): number {
  const value = process.env.NONCE_QUEUE_LOCK_TIMEOUT_S;
  if (!value) return 0;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    log(
      `Invalid NONCE_QUEUE_LOCK_TIMEOUT_S="${value}" (expected integer >= 0). Falling back to 0 (wait forever).`
    );
    return 0;
  }

  return parsed;
}

export function getNoncePool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool: PgPool } = require("pg");
    pool = new PgPool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 120_000,
    });
  }
  return pool;
}

function ensureNonceTable(p: Pool): Promise<void> {
  if (!tableEnsurePromise) {
    tableEnsurePromise = p
      .query(
        `
      CREATE TABLE IF NOT EXISTS nonce_queue (
        signer_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        nonce INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (signer_address, chain_id)
      )
    `
      )
      .then(() => {});
  }
  return tableEnsurePromise;
}

async function ensureNonceRow(
  client: PoolClient,
  signerAddress: string,
  chainId: number,
  getOnChainNonce: () => Promise<number>
): Promise<void> {
  const { rows } = await client.query(
    "SELECT 1 FROM nonce_queue WHERE signer_address = $1 AND chain_id = $2",
    [signerAddress, chainId]
  );
  // fetching the on-chain nonce only if there is no signer & chain id combination in the database
  if (rows.length === 0) {
    const onChainNonce = await getOnChainNonce();
    log(
      `Initializing nonce row: address=${signerAddress} chain=${chainId} nonce=${onChainNonce}`
    );
    await client.query(
      `INSERT INTO nonce_queue (signer_address, chain_id, nonce)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [signerAddress, chainId, onChainNonce]
    );
  }
}

function isLockTimeoutError(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    err?.code === "55P03" ||
    msg.includes("lock timeout") ||
    msg.includes("canceling statement due to lock timeout")
  );
}

async function withNonceLock<T>(
  p: Pool,
  signerAddress: string,
  chainId: number,
  getOnChainNonce: () => Promise<number>,
  fn: (nonce: number) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  await ensureNonceTable(p);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const client = await p.connect();
    const lockTimeoutSeconds = getNonceQueueLockTimeoutSeconds();
    try {
      await client.query("BEGIN");
      if (lockTimeoutSeconds > 0) {
        await client.query("SELECT set_config('lock_timeout', $1, true)", [
          `${lockTimeoutSeconds}s`,
        ]);
      }
      await ensureNonceRow(client, signerAddress, chainId, getOnChainNonce);

      const { rows } = await client.query(
        "SELECT nonce FROM nonce_queue WHERE signer_address = $1 AND chain_id = $2 FOR UPDATE",
        [signerAddress, chainId]
      );
      const nonce: number = rows[0].nonce;

      log(
        `Acquired nonce lock: address=${signerAddress} chain=${chainId} nonce=${nonce}`
      );

      const result = await fn(nonce);

      await client.query(
        "UPDATE nonce_queue SET nonce = nonce + 1, updated_at = NOW() WHERE signer_address = $1 AND chain_id = $2",
        [signerAddress, chainId]
      );
      await client.query("COMMIT");

      log(
        `Released nonce lock: address=${signerAddress} chain=${chainId} nonce=${nonce} → ${
          nonce + 1
        }`
      );

      return result;
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});

      if (isLockTimeoutError(err)) {
        const configuredTimeout =
          lockTimeoutSeconds > 0
            ? `${lockTimeoutSeconds}s`
            : "Postgres default";
        log(
          `Nonce lock timeout: unable to acquire lock for address=${signerAddress} chain=${chainId} within ${configuredTimeout}.`
        );
      }

      if (isNonceMismatchError(err)) {
        log(
          `Nonce mismatch (attempt ${
            attempt + 1
          }/${maxRetries}), recovering from chain…`
        );
        await recoverNonceFromChain({
          pool: p,
          signerAddress,
          chainId,
          getOnChainNonce,
        });
        if (attempt < maxRetries - 1) continue;
      }

      throw err;
    } finally {
      client.release();
    }
  }

  throw new Error("withNonceLock: max retries exhausted");
}

/** Reset module state. Only for testing. */
export function _resetForTesting() {
  tableEnsurePromise = null;
  pool = null;
}

/**
 * Wraps an ethers v5 Signer so that every `sendTransaction` call is
 * serialized through a Postgres row lock. The nonce is managed by the
 * database — not by the provider. The lock is held until the transaction
 * is confirmed on-chain, so concurrent processes block rather than collide.
 *
 * If DATABASE_URL is not set, the signer is returned unmodified.
 */
export function wrapWithNonceQueue(
  signer: ethers.Signer,
  chainId: number
): ethers.Signer {
  const p = getNoncePool();
  if (!p) return signer;

  const originalSendTransaction = signer.sendTransaction.bind(signer);
  const addressPromise = signer.getAddress().then((a) => a.toLowerCase());
  const getOnChainNonce = () => signer.getTransactionCount("pending");

  signer.sendTransaction = async function (
    transaction: Parameters<typeof originalSendTransaction>[0]
  ) {
    const signerAddress = await addressPromise;
    return withNonceLock(
      p,
      signerAddress,
      chainId,
      getOnChainNonce,
      async (nonce) => {
        return submitNonceQueuedTransaction({
          sendTransaction: originalSendTransaction,
          provider: signer.provider ?? undefined,
          transaction,
          nonce,
          signerAddress,
          chainId,
          onLifecycleEvent: (event) => {
            // Keep lifecycle persistence out-of-band so lock holders never
            // block on acquiring another DB connection from the same pool.
            void recordNonceQueueTxLifecycleEvent({
              pool: p,
              event,
            }).catch((err: any) => {
              // History persistence must not block transaction sending flow.
              log(
                `Failed to persist nonce-queue transaction history: type=${
                  event.type
                } address=${signerAddress} chain=${chainId} nonce=${nonce} error="${
                  err?.message ?? String(err)
                }"`
              );
            });
          },
        });
      }
    );
  };

  return signer;
}
