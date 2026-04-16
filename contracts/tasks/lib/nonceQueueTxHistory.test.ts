import { Pool } from "pg";

import { submitNonceQueuedTransaction } from "./nonceQueueTxLifecycle";
import {
  _resetNonceQueueTxHistoryForTesting,
  listNonceQueueTransactions,
  recordNonceQueueTxLifecycleEvent,
} from "./nonceQueueTxHistory";

type EnvOverrides = Record<string, string | undefined>;

if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL to run this test, e.g.:\n" +
      "  DATABASE_URL=postgresql://test:test@localhost:5433/nonce_test npx ts-node tasks/lib/nonceQueueTxHistory.test.ts"
  );
  process.exit(1);
}

function makeResponse(hash: string, raw?: string): any {
  return {
    hash,
    raw,
    rawTransaction: raw,
    wait: async () => ({
      status: 1,
      transactionHash: hash,
      blockNumber: 12345,
    }),
  };
}

async function withEnv<T>(overrides: EnvOverrides, fn: () => Promise<T>) {
  const previousValues: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    previousValues[key] = process.env[key];
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 5_000,
  pollMs = 50
) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

async function resetHistoryTable(pool: Pool) {
  await pool.query("DROP TABLE IF EXISTS nonce_queue_transactions");
  _resetNonceQueueTxHistoryForTesting();
}

async function testInitialSendCreatesPendingRow(pool: Pool) {
  console.log("--- Tx History Test 1: Initial send creates pending row ---");
  await resetHistoryTable(pool);

  let shouldMine = false;
  const signerSendTransaction = async () =>
    makeResponse("0xhist-pending", "0xraw");
  const provider: any = {
    async getTransactionReceipt() {
      if (!shouldMine) return null;
      return { status: 1, transactionHash: "0xhist-pending", blockNumber: 100 };
    },
    async getFeeData() {
      return {};
    },
    async sendTransaction(raw: string) {
      return makeResponse("0xhist-pending", raw);
    },
  };

  const txPromise = withEnv(
    {
      NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S: "20",
      NONCE_QUEUE_RECEIPT_POLL_S: "1",
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "0",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "0",
    },
    () =>
      submitNonceQueuedTransaction({
        sendTransaction: signerSendTransaction as any,
        provider,
        transaction: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
        } as any,
        nonce: 100,
        signerAddress: "0xAAAA",
        chainId: 1,
        onLifecycleEvent: (event) =>
          recordNonceQueueTxLifecycleEvent({ pool, event }),
      })
  );

  await waitFor(async () => {
    try {
      const { rows } = await pool.query(
        "SELECT status, lifecycle_state FROM nonce_queue_transactions WHERE tx_hash = $1",
        ["0xhist-pending"]
      );
      return rows.length === 1;
    } catch (err: any) {
      if (err?.code === "42P01") {
        return false;
      }
      throw err;
    }
  });

  const pendingRow = await pool.query(
    "SELECT status, lifecycle_state FROM nonce_queue_transactions WHERE tx_hash = $1",
    ["0xhist-pending"]
  );

  console.assert(
    pendingRow.rows[0].status === "pending",
    `Expected pending status, got ${pendingRow.rows[0].status}`
  );
  console.assert(
    pendingRow.rows[0].lifecycle_state === "submitted_initial",
    `Expected lifecycle_state=submitted_initial, got ${pendingRow.rows[0].lifecycle_state}`
  );

  shouldMine = true;
  await txPromise;
  console.log("PASS: pending row created on initial send\n");
}

async function testMinedSuccessPersistsCompleted(pool: Pool) {
  console.log("--- Tx History Test 2: Mined success marks completed ---");
  await resetHistoryTable(pool);

  const signerSendTransaction = async () =>
    makeResponse("0xhist-success", "0xraw");
  const provider: any = {
    async getTransactionReceipt() {
      return { status: 1, transactionHash: "0xhist-success", blockNumber: 200 };
    },
    async getFeeData() {
      return {};
    },
    async sendTransaction(raw: string) {
      return makeResponse("0xhist-success", raw);
    },
  };

  await withEnv(
    {
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "0",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "0",
    },
    () =>
      submitNonceQueuedTransaction({
        sendTransaction: signerSendTransaction as any,
        provider,
        transaction: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
        } as any,
        nonce: 101,
        signerAddress: "0xAAAA",
        chainId: 1,
        onLifecycleEvent: (event) =>
          recordNonceQueueTxLifecycleEvent({ pool, event }),
      })
  );

  const { rows } = await pool.query(
    "SELECT status, lifecycle_state, block_number FROM nonce_queue_transactions WHERE tx_hash = $1",
    ["0xhist-success"]
  );

  console.assert(rows[0].status === "completed", "Expected completed status");
  console.assert(
    rows[0].lifecycle_state === "confirmed",
    `Expected lifecycle_state=confirmed, got ${rows[0].lifecycle_state}`
  );
  console.assert(
    Number(rows[0].block_number) === 200,
    `Expected block_number=200, got ${rows[0].block_number}`
  );
  console.log("PASS: completed row persisted after mined success\n");
}

async function testMinedRevertPersistsFailed(pool: Pool) {
  console.log("--- Tx History Test 3: Mined revert marks failed/reverted ---");
  await resetHistoryTable(pool);

  const signerSendTransaction = async () =>
    makeResponse("0xhist-revert", "0xraw");
  const provider: any = {
    async getTransactionReceipt() {
      return { status: 0, transactionHash: "0xhist-revert", blockNumber: 300 };
    },
    async getFeeData() {
      return {};
    },
    async sendTransaction(raw: string) {
      return makeResponse("0xhist-revert", raw);
    },
  };

  let revertError: Error | undefined;
  await withEnv(
    {
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "0",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "0",
    },
    async () => {
      try {
        await submitNonceQueuedTransaction({
          sendTransaction: signerSendTransaction as any,
          provider,
          transaction: {
            to: "0x0000000000000000000000000000000000000001",
            data: "0x",
          } as any,
          nonce: 102,
          signerAddress: "0xAAAA",
          chainId: 1,
          onLifecycleEvent: (event) =>
            recordNonceQueueTxLifecycleEvent({ pool, event }),
        });
      } catch (err: any) {
        revertError = err;
      }
    }
  );

  if (!revertError) {
    throw new Error("Expected revert error");
  }

  const { rows } = await pool.query(
    "SELECT status, lifecycle_state FROM nonce_queue_transactions WHERE tx_hash = $1",
    ["0xhist-revert"]
  );
  console.assert(rows[0].status === "failed", "Expected failed status");
  console.assert(
    rows[0].lifecycle_state === "reverted",
    `Expected lifecycle_state=reverted, got ${rows[0].lifecycle_state}`
  );
  console.log("PASS: reverted row persisted as failed/reverted\n");
}

async function testTimeoutMarksPendingRows(pool: Pool) {
  console.log("--- Tx History Test 4: Timeout marks failed/timed_out ---");
  await resetHistoryTable(pool);

  const signerSendTransaction = async () =>
    makeResponse("0xhist-timeout", "0xraw");
  const provider: any = {
    async getTransactionReceipt() {
      return null;
    },
    async getFeeData() {
      return {};
    },
    async sendTransaction(raw: string) {
      return makeResponse("0xhist-timeout", raw);
    },
  };

  let timeoutError: Error | undefined;
  await withEnv(
    {
      NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S: "2",
      NONCE_QUEUE_RECEIPT_POLL_S: "1",
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "0",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "0",
    },
    async () => {
      try {
        await submitNonceQueuedTransaction({
          sendTransaction: signerSendTransaction as any,
          provider,
          transaction: {
            to: "0x0000000000000000000000000000000000000001",
            data: "0x",
          } as any,
          nonce: 103,
          signerAddress: "0xAAAA",
          chainId: 1,
          onLifecycleEvent: (event) =>
            recordNonceQueueTxLifecycleEvent({ pool, event }),
        });
      } catch (err: any) {
        timeoutError = err;
      }
    }
  );

  if (!timeoutError) {
    throw new Error("Expected timeout error");
  }

  const { rows } = await pool.query(
    "SELECT status, lifecycle_state, error_message FROM nonce_queue_transactions WHERE tx_hash = $1",
    ["0xhist-timeout"]
  );
  console.assert(rows[0].status === "failed", "Expected failed status");
  console.assert(
    rows[0].lifecycle_state === "timed_out",
    `Expected lifecycle_state=timed_out, got ${rows[0].lifecycle_state}`
  );
  console.assert(
    String(rows[0].error_message).includes(
      "Timed out waiting for nonce-queued tx confirmation"
    ),
    `Expected timeout error message, got ${rows[0].error_message}`
  );
  console.log("PASS: timeout persisted as failed/timed_out\n");
}

async function testReplacementPathPersistsWinnerAndLoser(pool: Pool) {
  console.log("--- Tx History Test 5: Replacement winner/loser states ---");
  await resetHistoryTable(pool);

  let sendCount = 0;
  const signerSendTransaction = async () => {
    if (sendCount === 0) {
      sendCount++;
      return makeResponse("0xhist-initial", "0xraw-initial");
    }
    sendCount++;
    return makeResponse("0xhist-replacement", "0xraw-replacement");
  };

  let receiptChecks = 0;
  const provider: any = {
    async getTransactionReceipt(hash: string) {
      receiptChecks++;
      if (hash === "0xhist-replacement" && receiptChecks >= 4) {
        return {
          status: 1,
          transactionHash: "0xhist-replacement",
          blockNumber: 400,
        };
      }
      return null;
    },
    async getFeeData() {
      return {
        maxFeePerGas: 400,
        maxPriorityFeePerGas: 5,
      };
    },
    async sendTransaction() {
      throw new Error("rebroadcast disabled");
    },
  };

  await withEnv(
    {
      NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S: "20",
      NONCE_QUEUE_RECEIPT_POLL_S: "1",
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "0",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "1",
      NONCE_QUEUE_MAX_REPLACEMENTS: "2",
      NONCE_QUEUE_FEE_BUMP_PCT: "20",
    },
    () =>
      submitNonceQueuedTransaction({
        sendTransaction: signerSendTransaction as any,
        provider,
        transaction: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
          maxFeePerGas: 100,
          maxPriorityFeePerGas: 2,
        } as any,
        nonce: 104,
        signerAddress: "0xAAAA",
        chainId: 1,
        onLifecycleEvent: (event) =>
          recordNonceQueueTxLifecycleEvent({ pool, event }),
      })
  );

  const records = await listNonceQueueTransactions({
    pool,
    params: { limit: 10, address: "0xaaaa", chainId: 1 },
  });
  const initial = records.find((row) => row.txHash === "0xhist-initial");
  const replacement = records.find(
    (row) => row.txHash === "0xhist-replacement"
  );

  if (!initial || !replacement) {
    throw new Error("Expected both initial and replacement rows");
  }

  console.assert(
    initial.status === "failed" && initial.lifecycleState === "replaced",
    `Expected initial row failed/replaced, got ${initial.status}/${initial.lifecycleState}`
  );
  console.assert(
    replacement.status === "completed" &&
      replacement.lifecycleState === "confirmed",
    `Expected replacement row completed/confirmed, got ${replacement.status}/${replacement.lifecycleState}`
  );
  console.log("PASS: replacement winner/loser rows persisted correctly\n");
}

async function testRebroadcastIncrementsSendCount(pool: Pool) {
  console.log("--- Tx History Test 6: Rebroadcast increments send_count ---");
  await resetHistoryTable(pool);

  const signerSendTransaction = async () =>
    makeResponse("0xhist-rebroadcast", "0xraw");

  let receiptChecks = 0;
  let providerSends = 0;
  const provider: any = {
    async getTransactionReceipt(hash: string) {
      receiptChecks++;
      if (hash === "0xhist-rebroadcast" && receiptChecks >= 3) {
        return {
          status: 1,
          transactionHash: "0xhist-rebroadcast",
          blockNumber: 500,
        };
      }
      return null;
    },
    async getFeeData() {
      return {};
    },
    async sendTransaction(raw: string) {
      providerSends++;
      return makeResponse("0xhist-rebroadcast", raw);
    },
  };

  await withEnv(
    {
      NONCE_QUEUE_TX_CONFIRM_TIMEOUT_S: "10",
      NONCE_QUEUE_RECEIPT_POLL_S: "1",
      NONCE_QUEUE_REBROADCAST_INTERVAL_S: "1",
      NONCE_QUEUE_REPLACE_INTERVAL_S: "0",
    },
    () =>
      submitNonceQueuedTransaction({
        sendTransaction: signerSendTransaction as any,
        provider,
        transaction: {
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
        } as any,
        nonce: 105,
        signerAddress: "0xAAAA",
        chainId: 1,
        onLifecycleEvent: (event) =>
          recordNonceQueueTxLifecycleEvent({ pool, event }),
      })
  );

  console.assert(
    providerSends === 1,
    `Expected 1 rebroadcast, got ${providerSends}`
  );

  const { rows } = await pool.query(
    "SELECT send_count, status FROM nonce_queue_transactions WHERE tx_hash = $1",
    ["0xhist-rebroadcast"]
  );

  console.assert(rows.length === 1, `Expected 1 row, got ${rows.length}`);
  console.assert(
    Number(rows[0].send_count) === 2,
    `Expected send_count=2, got ${rows[0].send_count}`
  );
  console.assert(rows[0].status === "completed", "Expected completed status");
  console.log(
    "PASS: rebroadcast upsert increments send_count without duplicates\n"
  );
}

async function test() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await testInitialSendCreatesPendingRow(pool);
    await testMinedSuccessPersistsCompleted(pool);
    await testMinedRevertPersistsFailed(pool);
    await testTimeoutMarksPendingRows(pool);
    await testReplacementPathPersistsWinnerAndLoser(pool);
    await testRebroadcastIncrementsSendCount(pool);
    console.log("All nonceQueueTxHistory tests passed!");
  } finally {
    await pool.end();
  }
}

test().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
