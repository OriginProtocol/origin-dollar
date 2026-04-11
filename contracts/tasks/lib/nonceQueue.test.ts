/**
 * Integration test for the Postgres nonce queue.
 *
 * Prerequisites:
 *   docker run -d --name nonce-test-pg -p 5433:5432 \
 *     -e POSTGRES_DB=nonce_test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test \
 *     postgres:16-alpine
 *
 * Run:
 *   DATABASE_URL=postgresql://test:test@localhost:5433/nonce_test \
 *     npx ts-node tasks/lib/nonceQueue.test.ts
 */

import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  console.error(
    "Set DATABASE_URL to run this test, e.g.:\n" +
      "  DATABASE_URL=postgresql://test:test@localhost:5433/nonce_test npx ts-node tasks/lib/nonceQueue.test.ts"
  );
  process.exit(1);
}

import {
  wrapWithNonceQueue,
  getNoncePool,
  _resetForTesting,
} from "./nonceQueue";

// Minimal mock signer for testing
function createMockSigner(
  address: string,
  onSend: (nonce: number) => Promise<void>
) {
  const signer: any = {
    getAddress: async () => address,
    getTransactionCount: async () => 0,
    provider: {
      getNetwork: async () => ({ chainId: 1 }),
    },
    sendTransaction: async (tx: any) => {
      await onSend(tx.nonce);
      return {
        hash: "0x" + Math.random().toString(16).slice(2),
        from: address,
        nonce: tx.nonce,
        wait: async () => ({ status: 1 }),
      };
    },
    signMessage: async () => "0x",
    signTransaction: async () => "0x",
    connect: () => signer,
    _isSigner: true,
  };
  return signer;
}

/** Drop and recreate table, reset module state */
async function resetAll() {
  // Close any existing pool in the module
  const existing = getNoncePool();
  if (existing) await existing.end();
  _resetForTesting();

  // Drop table directly
  const tmpPool = new Pool({ connectionString: process.env.DATABASE_URL });
  await tmpPool.query("DROP TABLE IF EXISTS nonce_queue");
  await tmpPool.end();
}

async function test() {
  const results: {
    id: number;
    nonce: number;
    startMs: number;
    endMs: number;
  }[] = [];

  // --- Test 1 ---
  console.log("--- Test 1: Sequential nonce assignment ---");
  await resetAll();

  const signer1 = createMockSigner("0xaaaa", async (nonce) => {
    results.push({ id: 1, nonce, startMs: Date.now(), endMs: 0 });
    await new Promise((r) => setTimeout(r, 100));
    results[results.length - 1].endMs = Date.now();
  });

  const wrapped1 = wrapWithNonceQueue(signer1, 1);

  for (let i = 0; i < 3; i++) {
    await wrapped1.sendTransaction({ to: "0xbbbb", data: "0x" });
  }

  console.log("Results:", results.map((r) => `nonce=${r.nonce}`).join(", "));
  const nonces = results.map((r) => r.nonce);
  console.assert(
    nonces[0] === 0 && nonces[1] === 1 && nonces[2] === 2,
    `Expected nonces [0,1,2] but got [${nonces}]`
  );
  console.log("PASS: Sequential nonces assigned correctly\n");

  // --- Test 2 ---
  console.log("--- Test 2: Concurrent processes block on lock ---");
  results.length = 0;
  await resetAll();

  const signer2a = createMockSigner("0xaaaa", async (nonce) => {
    results.push({ id: 1, nonce, startMs: Date.now(), endMs: 0 });
    await new Promise((r) => setTimeout(r, 500)); // Hold lock for 500ms
    results[results.length - 1].endMs = Date.now();
  });
  const signer2b = createMockSigner("0xaaaa", async (nonce) => {
    results.push({ id: 2, nonce, startMs: Date.now(), endMs: 0 });
    await new Promise((r) => setTimeout(r, 100));
    results[results.length - 1].endMs = Date.now();
  });

  // Wrap both, then start them with a short stagger to ensure both hit the
  // DB lock. The first acquires it immediately; the second blocks on FOR UPDATE.
  const wrapped2a = wrapWithNonceQueue(signer2a, 1);
  const wrapped2b = wrapWithNonceQueue(signer2b, 1);

  const p1 = wrapped2a.sendTransaction({ to: "0xbbbb", data: "0x" });
  // Small delay so both connections are open and racing for the lock
  await new Promise((r) => setTimeout(r, 50));
  const p2 = wrapped2b.sendTransaction({ to: "0xbbbb", data: "0x" });

  await Promise.all([p1, p2]);

  console.log(
    "Results:",
    results.map((r) => `id=${r.id} nonce=${r.nonce}`).join(", ")
  );

  const sortedNonces = results.map((r) => r.nonce).sort();
  console.assert(
    sortedNonces[0] === 0 && sortedNonces[1] === 1,
    `Expected nonces [0,1] but got [${sortedNonces}]`
  );

  // The key assertion: second tx's onSend must start AFTER first tx's onSend
  // finishes, proving the DB lock serialized them.
  const sorted = [...results].sort((a, b) => a.startMs - b.startMs);
  const gap = sorted[1].startMs - sorted[0].endMs;
  console.log(
    `  First tx: ${sorted[0].startMs}-${sorted[0].endMs} (${sorted[0].endMs - sorted[0].startMs}ms)`
  );
  console.log(
    `  Second tx: ${sorted[1].startMs}-${sorted[1].endMs} (${sorted[1].endMs - sorted[1].startMs}ms)`
  );
  console.log(`  Gap between first end and second start: ${gap}ms`);
  console.assert(
    gap >= -50, // small tolerance for timing jitter
    `Second tx started ${-gap}ms BEFORE first finished — lock didn't serialize!`
  );
  console.log("PASS: Concurrent transactions serialized correctly\n");

  // --- Test 3 ---
  console.log("--- Test 3: Different chains have independent nonces ---");
  results.length = 0;
  await resetAll();

  const signer3a = createMockSigner("0xaaaa", async (nonce) => {
    results.push({ id: 1, nonce, startMs: Date.now(), endMs: 0 });
  });
  const signer3b = createMockSigner("0xaaaa", async (nonce) => {
    results.push({ id: 2, nonce, startMs: Date.now(), endMs: 0 });
  });

  const wrappedMainnet = wrapWithNonceQueue(signer3a, 1);
  const wrappedSonic = wrapWithNonceQueue(signer3b, 146);

  await wrappedMainnet.sendTransaction({ to: "0xbbbb", data: "0x" });
  await wrappedSonic.sendTransaction({ to: "0xbbbb", data: "0x" });

  console.log(
    "Results:",
    results.map((r) => `chain=${r.id} nonce=${r.nonce}`).join(", ")
  );
  console.assert(
    results[0].nonce === 0 && results[1].nonce === 0,
    `Expected both nonces to be 0 but got [${results.map((r) => r.nonce)}]`
  );
  console.log("PASS: Independent nonces per chain\n");

  // --- Test 4 ---
  console.log("--- Test 4: Rollback on failure keeps nonce ---");
  results.length = 0;
  await resetAll();

  let callCount = 0;
  const signerFail = createMockSigner("0xaaaa", async (nonce) => {
    callCount++;
    results.push({ id: callCount, nonce, startMs: Date.now(), endMs: 0 });
    if (callCount === 1) {
      throw new Error("Transaction reverted");
    }
  });

  const wrappedFail = wrapWithNonceQueue(signerFail, 1);

  try {
    await wrappedFail.sendTransaction({ to: "0xbbbb", data: "0x" });
  } catch (e: any) {
    console.log(`First tx failed as expected: ${e.message}`);
  }

  await wrappedFail.sendTransaction({ to: "0xbbbb", data: "0x" });

  console.log(
    "Results:",
    results.map((r) => `id=${r.id} nonce=${r.nonce}`).join(", ")
  );
  console.assert(
    results[0].nonce === 0 && results[1].nonce === 0,
    `Expected both nonces to be 0 but got [${results.map((r) => r.nonce)}]`
  );
  console.log("PASS: Nonce preserved after rollback\n");

  // --- Cleanup ---
  const pool = getNoncePool();
  if (pool) await pool.end();
  console.log("All tests passed!");
}

test().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
