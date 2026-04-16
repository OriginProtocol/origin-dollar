import type { Pool } from "pg";

const EXPLORER_TX_BASE_BY_CHAIN: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  17000: "https://holesky.etherscan.io/tx/",
};

let tableEnsurePromise: Promise<void> | null = null;

export type NonceQueueTxStage = "initial" | "replacement" | "rebroadcast";

export type NonceQueueTxStatus = "pending" | "completed" | "failed";

export type NonceQueueTxLifecycleState =
  | "submitted_initial"
  | "submitted_replacement"
  | "submitted_rebroadcast"
  | "confirmed"
  | "reverted"
  | "replaced"
  | "timed_out"
  | "send_error";

export type NonceQueueTxLifecycleEvent =
  | {
      type: "send_accepted";
      txHash: string;
      stage: NonceQueueTxStage;
      signerAddress: string;
      chainId: number;
      nonce: number;
    }
  | {
      type: "mined_success";
      txHash: string;
      signerAddress: string;
      chainId: number;
      nonce: number;
      blockNumber: number | null;
    }
  | {
      type: "mined_revert";
      txHash: string;
      signerAddress: string;
      chainId: number;
      nonce: number;
      blockNumber: number | null;
      errorMessage?: string;
    }
  | {
      type: "timeout";
      signerAddress: string;
      chainId: number;
      nonce: number;
      errorMessage: string;
    }
  | {
      type: "terminal_send_error";
      signerAddress: string;
      chainId: number;
      nonce: number;
      errorMessage: string;
      txHash?: string;
    };

export interface NonceQueueTransactionRecord {
  txHash: string;
  signerAddress: string;
  chainId: number;
  nonce: number;
  stage: NonceQueueTxStage;
  status: NonceQueueTxStatus;
  lifecycleState: string;
  explorerUrl: string | null;
  sendCount: number;
  blockNumber: number | null;
  errorMessage: string | null;
  submittedAt: string;
  finalizedAt: string | null;
  updatedAt: string;
}

export interface ListNonceQueueTransactionsParams {
  limit: number;
  address?: string;
  chainId?: number;
}

function lifecycleStateForSubmit(
  stage: NonceQueueTxStage
): NonceQueueTxLifecycleState {
  if (stage === "initial") return "submitted_initial";
  if (stage === "replacement") return "submitted_replacement";
  return "submitted_rebroadcast";
}

function explorerUrlForHash(chainId: number, txHash: string): string | null {
  const base = EXPLORER_TX_BASE_BY_CHAIN[chainId];
  return base ? `${base}${txHash}` : null;
}

async function ensureNonceQueueTransactionsTable(pool: Pool): Promise<void> {
  if (!tableEnsurePromise) {
    tableEnsurePromise = pool
      .query(
        `
      CREATE TABLE IF NOT EXISTS nonce_queue_transactions (
        tx_hash TEXT PRIMARY KEY,
        signer_address TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        nonce INTEGER NOT NULL,
        stage TEXT NOT NULL CHECK (stage IN ('initial', 'replacement', 'rebroadcast')),
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
        lifecycle_state TEXT NOT NULL,
        explorer_url TEXT,
        send_count INTEGER NOT NULL DEFAULT 1,
        block_number INTEGER,
        error_message TEXT,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finalized_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS nonce_queue_transactions_submitted_at_idx
        ON nonce_queue_transactions (submitted_at DESC);

      CREATE INDEX IF NOT EXISTS nonce_queue_transactions_address_chain_submitted_at_idx
        ON nonce_queue_transactions (signer_address, chain_id, submitted_at DESC);
    `
      )
      .then(() => {});
  }

  await tableEnsurePromise;
}

export async function recordNonceQueueTxLifecycleEvent({
  pool,
  event,
}: {
  pool: Pool;
  event: NonceQueueTxLifecycleEvent;
}): Promise<void> {
  await ensureNonceQueueTransactionsTable(pool);

  const signerAddress = event.signerAddress.toLowerCase();

  if (event.type === "send_accepted") {
    const lifecycleState = lifecycleStateForSubmit(event.stage);
    await pool.query(
      `
      INSERT INTO nonce_queue_transactions (
        tx_hash,
        signer_address,
        chain_id,
        nonce,
        stage,
        status,
        lifecycle_state,
        explorer_url,
        send_count,
        submitted_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, 1, NOW(), NOW())
      ON CONFLICT (tx_hash) DO UPDATE SET
        send_count = nonce_queue_transactions.send_count + 1,
        stage = EXCLUDED.stage,
        lifecycle_state = EXCLUDED.lifecycle_state,
        explorer_url = COALESCE(nonce_queue_transactions.explorer_url, EXCLUDED.explorer_url),
        updated_at = NOW(),
        error_message = NULL
    `,
      [
        event.txHash,
        signerAddress,
        event.chainId,
        event.nonce,
        event.stage,
        lifecycleState,
        explorerUrlForHash(event.chainId, event.txHash),
      ]
    );
    return;
  }

  if (event.type === "timeout") {
    await pool.query(
      `
      UPDATE nonce_queue_transactions
      SET
        status = 'failed',
        lifecycle_state = 'timed_out',
        finalized_at = COALESCE(finalized_at, NOW()),
        updated_at = NOW(),
        error_message = $4
      WHERE signer_address = $1
        AND chain_id = $2
        AND nonce = $3
        AND status = 'pending'
    `,
      [signerAddress, event.chainId, event.nonce, event.errorMessage]
    );
    return;
  }

  if (event.type === "terminal_send_error") {
    if (event.txHash) {
      await pool.query(
        `
        UPDATE nonce_queue_transactions
        SET
          status = 'failed',
          lifecycle_state = 'send_error',
          finalized_at = COALESCE(finalized_at, NOW()),
          updated_at = NOW(),
          error_message = $2
        WHERE tx_hash = $1
          AND status = 'pending'
      `,
        [event.txHash, event.errorMessage]
      );
      return;
    }

    await pool.query(
      `
      UPDATE nonce_queue_transactions
      SET
        status = 'failed',
        lifecycle_state = 'send_error',
        finalized_at = COALESCE(finalized_at, NOW()),
        updated_at = NOW(),
        error_message = $4
      WHERE signer_address = $1
        AND chain_id = $2
        AND nonce = $3
        AND status = 'pending'
    `,
      [signerAddress, event.chainId, event.nonce, event.errorMessage]
    );
    return;
  }

  const client = await pool.connect();
  const isSuccess = event.type === "mined_success";
  const minedStatus: NonceQueueTxStatus = isSuccess ? "completed" : "failed";
  const minedLifecycleState: NonceQueueTxLifecycleState = isSuccess
    ? "confirmed"
    : "reverted";

  try {
    await client.query("BEGIN");

    await client.query(
      `
      UPDATE nonce_queue_transactions
      SET
        status = $2,
        lifecycle_state = $3,
        block_number = $4,
        finalized_at = COALESCE(finalized_at, NOW()),
        updated_at = NOW(),
        error_message = $5
      WHERE tx_hash = $1
    `,
      [
        event.txHash,
        minedStatus,
        minedLifecycleState,
        event.blockNumber,
        isSuccess
          ? null
          : event.errorMessage ?? "Nonce-queued transaction reverted",
      ]
    );

    await client.query(
      `
      UPDATE nonce_queue_transactions
      SET
        status = 'failed',
        lifecycle_state = 'replaced',
        finalized_at = COALESCE(finalized_at, NOW()),
        updated_at = NOW(),
        error_message = $5
      WHERE signer_address = $1
        AND chain_id = $2
        AND nonce = $3
        AND tx_hash <> $4
        AND status = 'pending'
    `,
      [
        signerAddress,
        event.chainId,
        event.nonce,
        event.txHash,
        `Replaced by mined transaction ${event.txHash}`,
      ]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function listNonceQueueTransactions({
  pool,
  params,
}: {
  pool: Pool;
  params: ListNonceQueueTransactionsParams;
}): Promise<NonceQueueTransactionRecord[]> {
  await ensureNonceQueueTransactionsTable(pool);

  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (params.address) {
    values.push(params.address.toLowerCase());
    clauses.push(`signer_address = $${values.length}`);
  }

  if (params.chainId !== undefined) {
    values.push(params.chainId);
    clauses.push(`chain_id = $${values.length}`);
  }

  values.push(params.limit);
  const limitParam = `$${values.length}`;
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `
    SELECT
      tx_hash,
      signer_address,
      chain_id,
      nonce,
      stage,
      status,
      lifecycle_state,
      explorer_url,
      send_count,
      block_number,
      error_message,
      submitted_at,
      finalized_at,
      updated_at
    FROM nonce_queue_transactions
    ${where}
    ORDER BY submitted_at DESC
    LIMIT ${limitParam}
  `,
    values
  );

  return rows.map((row: any) => ({
    txHash: row.tx_hash,
    signerAddress: row.signer_address,
    chainId: Number(row.chain_id),
    nonce: Number(row.nonce),
    stage: row.stage,
    status: row.status,
    lifecycleState: row.lifecycle_state,
    explorerUrl: row.explorer_url,
    sendCount: Number(row.send_count),
    blockNumber:
      row.block_number === null || row.block_number === undefined
        ? null
        : Number(row.block_number),
    errorMessage: row.error_message,
    submittedAt: new Date(row.submitted_at).toISOString(),
    finalizedAt: row.finalized_at
      ? new Date(row.finalized_at).toISOString()
      : null,
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

/** Reset module state. Only for testing. */
export function _resetNonceQueueTxHistoryForTesting() {
  tableEnsurePromise = null;
}

export function _getExplorerTxBaseByChainForTesting() {
  return EXPLORER_TX_BASE_BY_CHAIN;
}
