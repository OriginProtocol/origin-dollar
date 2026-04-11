// Minimal test action that mimics the real action() wrapper's logging pattern.
// Used by action-runner.test.ts — no network or signer required.

import logger, { flushLogger } from "../tasks/lib/logger";

const runId = process.env.AUTOMATON_RUN_ID;
const shouldFail = process.argv.includes("--fail");

const log = logger.child({
  action: "test_action",
  ...(runId ? { run_id: runId } : {}),
});

async function main() {
  const startTime = Date.now();
  try {
    log.info("Running on testnet (31337)");
    log.info("Checking balances");
    log.info("Balance: 1000000000000000000 wei");

    if (shouldFail) {
      throw new Error("Simulated failure for testing");
    }

    log.info("Test action passed");
  } catch (err: any) {
    log.error(`${err.name}: ${err.message}`, {
      event: "action.error",
      source: "task",
      chain_id: 31337,
      network: "testnet",
      duration_ms: Date.now() - startTime,
      error_name: err.name,
      error_message: err.message,
    });
    process.exitCode = 1;
  } finally {
    await flushLogger();
  }
}

main();
