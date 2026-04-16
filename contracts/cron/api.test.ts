import { once } from "node:events";
import { Pool } from "pg";

import { createApi } from "./api";
import {
  _resetNonceQueueTxHistoryForTesting,
  recordNonceQueueTxLifecycleEvent,
} from "../tasks/lib/nonceQueueTxHistory";

if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL to run this test, e.g.:\n" +
      "  DATABASE_URL=postgresql://test:test@localhost:5433/nonce_test npx ts-node cron/api.test.ts"
  );
  process.exit(1);
}

const TEST_TOKEN = "test-token";
const ADDRESS_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ADDRESS_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function assert(condition: any, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function resetAndSeed(pool: Pool) {
  await pool.query("DROP TABLE IF EXISTS nonce_queue_transactions");
  _resetNonceQueueTxHistoryForTesting();

  await recordNonceQueueTxLifecycleEvent({
    pool,
    event: {
      type: "send_accepted",
      txHash: "0xseed",
      stage: "initial",
      signerAddress: ADDRESS_A,
      chainId: 1,
      nonce: 0,
    },
  });
  await pool.query("TRUNCATE TABLE nonce_queue_transactions");

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
        block_number,
        error_message,
        submitted_at,
        finalized_at,
        updated_at
      )
      SELECT
        '0xmain' || lpad(gs::text, 6, '0'),
        $1,
        1,
        gs,
        'initial',
        CASE WHEN gs % 2 = 0 THEN 'completed' ELSE 'pending' END,
        CASE WHEN gs % 2 = 0 THEN 'confirmed' ELSE 'submitted_initial' END,
        'https://etherscan.io/tx/' || '0xmain' || lpad(gs::text, 6, '0'),
        1,
        CASE WHEN gs % 2 = 0 THEN gs ELSE NULL END,
        NULL,
        NOW() - (gs::text || ' seconds')::interval,
        CASE WHEN gs % 2 = 0 THEN NOW() - ((gs - 1)::text || ' seconds')::interval ELSE NULL END,
        NOW()
      FROM generate_series(1, 510) AS gs
    `,
    [ADDRESS_A]
  );

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
        block_number,
        error_message,
        submitted_at,
        finalized_at,
        updated_at
      )
      SELECT
        '0xb' || lpad(gs::text, 6, '0'),
        $1,
        1,
        gs,
        'initial',
        'completed',
        'confirmed',
        'https://etherscan.io/tx/' || '0xb' || lpad(gs::text, 6, '0'),
        1,
        gs,
        NULL,
        NOW() - ((510 + gs)::text || ' seconds')::interval,
        NOW() - ((510 + gs - 1)::text || ' seconds')::interval,
        NOW()
      FROM generate_series(1, 5) AS gs
    `,
    [ADDRESS_B]
  );

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
        block_number,
        error_message,
        submitted_at,
        finalized_at,
        updated_at
      )
      SELECT
        '0xbase' || lpad(gs::text, 6, '0'),
        $1,
        8453,
        gs,
        'initial',
        'completed',
        'confirmed',
        'https://basescan.org/tx/' || '0xbase' || lpad(gs::text, 6, '0'),
        1,
        gs,
        NULL,
        NOW() - ((520 + gs)::text || ' seconds')::interval,
        NOW() - ((520 + gs - 1)::text || ' seconds')::interval,
        NOW()
      FROM generate_series(1, 5) AS gs
    `,
    [ADDRESS_A]
  );
}

async function startTestServer() {
  const server = createApi({
    host: "127.0.0.1",
    port: 0,
    apiToken: TEST_TOKEN,
    jobs: [],
    jobsByName: new Map(),
    workdir: process.cwd(),
    historyLimit: 100,
    healthCheck: () => ({ running: true, pid: 1 }),
    log: console as any,
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addressInfo = server.address();
  if (!addressInfo || typeof addressInfo === "string") {
    throw new Error("Could not determine test server port");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${addressInfo.port}`,
  };
}

async function getJson(
  baseUrl: string,
  path: string,
  opts: { auth?: boolean } = {}
) {
  const headers: Record<string, string> = {};
  if (opts.auth !== false) {
    headers.Authorization = `Bearer ${TEST_TOKEN}`;
  }

  const res = await fetch(`${baseUrl}${path}`, { headers });
  const payload = await res.json();
  return { status: res.status, payload };
}

async function testApiTransactionsEndpoint(pool: Pool) {
  console.log("--- API Test: /api/v1/transactions ---");
  await resetAndSeed(pool);

  const { server, baseUrl } = await startTestServer();
  try {
    const unauthorized = await getJson(baseUrl, "/api/v1/transactions", {
      auth: false,
    });
    assert(
      unauthorized.status === 401,
      `Expected 401 for unauthorized /api/v1/transactions, got ${unauthorized.status}`
    );

    const unauthorizedActions = await getJson(baseUrl, "/api/v1/actions", {
      auth: false,
    });
    assert(
      unauthorizedActions.status === 401,
      `Expected 401 for unauthorized /api/v1/actions, got ${unauthorizedActions.status}`
    );

    const defaultLimit = await getJson(baseUrl, "/api/v1/transactions");
    assert(defaultLimit.status === 200, "Expected 200 for default list");
    assert(
      defaultLimit.payload.transactions.length === 50,
      `Expected default limit 50, got ${defaultLimit.payload.transactions.length}`
    );

    const clamped = await getJson(baseUrl, "/api/v1/transactions?limit=999");
    assert(clamped.status === 200, "Expected 200 for clamped list");
    assert(
      clamped.payload.transactions.length === 500,
      `Expected clamped limit 500, got ${clamped.payload.transactions.length}`
    );

    const byAddress = await getJson(
      baseUrl,
      `/api/v1/transactions?limit=50&address=${ADDRESS_B}`
    );
    assert(byAddress.status === 200, "Expected 200 for address filter");
    assert(
      byAddress.payload.transactions.length === 5,
      `Expected 5 rows for address filter, got ${byAddress.payload.transactions.length}`
    );
    assert(
      byAddress.payload.transactions.every(
        (row: any) => row.signerAddress === ADDRESS_B
      ),
      "Address filter returned rows for different address"
    );

    const byChain = await getJson(
      baseUrl,
      "/api/v1/transactions?limit=50&chainId=8453"
    );
    assert(byChain.status === 200, "Expected 200 for chain filter");
    assert(
      byChain.payload.transactions.length === 5,
      `Expected 5 rows for chain filter, got ${byChain.payload.transactions.length}`
    );
    assert(
      byChain.payload.transactions.every((row: any) => row.chainId === 8453),
      "Chain filter returned rows for different chain"
    );

    const byAddressAndChain = await getJson(
      baseUrl,
      `/api/v1/transactions?limit=50&address=${ADDRESS_A}&chainId=8453`
    );
    assert(
      byAddressAndChain.status === 200,
      "Expected 200 for address+chain filter"
    );
    assert(
      byAddressAndChain.payload.transactions.length === 5,
      `Expected 5 rows for address+chain filter, got ${byAddressAndChain.payload.transactions.length}`
    );
    assert(
      byAddressAndChain.payload.transactions.every(
        (row: any) => row.signerAddress === ADDRESS_A && row.chainId === 8453
      ),
      "Address+chain filter returned unexpected rows"
    );

    const sample = defaultLimit.payload.transactions[0];
    for (const key of [
      "txHash",
      "signerAddress",
      "chainId",
      "nonce",
      "stage",
      "status",
      "lifecycleState",
      "explorerUrl",
      "submittedAt",
      "finalizedAt",
      "blockNumber",
      "errorMessage",
      "sendCount",
    ]) {
      assert(
        sample[key] !== undefined,
        `Expected field ${key} on response row`
      );
    }

    console.log("PASS: transactions endpoint auth, limits, and filters\n");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function test() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await testApiTransactionsEndpoint(pool);
    console.log("All cron api tests passed!");
  } finally {
    await pool.end();
  }
}

test().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
