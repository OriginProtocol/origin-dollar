// Snapshot test for the action framework's structured logging.
//
// Calls createActionHandler() directly with a mock signer, capturing winston
// records via a capture transport. Tests the real code path in action.ts.
//
// Run with: npx ts-node tasks/lib/action.test.ts
// Update snapshot: npx ts-node tasks/lib/action.test.ts --update

import fs from "node:fs";
import path from "node:path";
import { format, transports } from "winston";
import { createActionHandler } from "./action";
import type { ActionContext } from "./action";
import logger from "./logger";

process.env.WINSTON_LOG_MODE_ENABLED = "true";

const SNAPSHOT_PATH = path.join(__dirname, "action.snapshot.jsonl");
const updateSnapshot = process.argv.includes("--update");

// --- Winston capture ---------------------------------------------------------

const captured: Record<string, unknown>[] = [];
const captureFormat = format((info) => {
  captured.push({ ...info });
  return false;
});
logger.add(new transports.Console({ format: captureFormat() }));

function stabilize(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === "timestamp") continue;
    if (k === "duration_ms") {
      out[k] = "<number>";
      continue;
    }
    if (k === "error_stack" && typeof v === "string") {
      out[k] = v.split("\n")[0];
      continue;
    }
    if (k === "run_id") {
      out[k] = "<uuid>";
      continue;
    }
    out[k] = v;
  }
  return out;
}

// --- Mock signer -------------------------------------------------------------

function mockSigner(chainId: number) {
  return async () =>
    ({
      provider: {
        getNetwork: async () => ({ chainId: BigInt(chainId) }),
      },
    }) as any;
}

// --- Scenarios ---------------------------------------------------------------

async function runSuccessScenario() {
  const handler = createActionHandler(
    {
      name: "test_harvest",
      description: "test",
      run: async (ctx: ActionContext) => {
        ctx.log.info("Harvesting rewards");
        ctx.log.info("Swapped 100 CRV -> 0.5 ETH");
      },
    },
    { getSigner: mockSigner(1) },
  );
  await handler({});
}

async function runErrorScenario() {
  const handler = createActionHandler(
    {
      name: "test_harvest",
      description: "test",
      run: async () => {
        throw new Error("insufficient funds for gas");
      },
    },
    { getSigner: mockSigner(1) },
  );
  try {
    await handler({});
  } catch {
    // expected
  }
}

async function runChainValidationScenario() {
  const handler = createActionHandler(
    {
      name: "sonic_only_action",
      description: "test",
      chains: [146],
      run: async () => {},
    },
    { getSigner: mockSigner(1) },
  );
  try {
    await handler({});
  } catch {
    // expected
  }
}

// --- Main --------------------------------------------------------------------

async function main() {
  await runSuccessScenario();
  await runErrorScenario();
  await runChainValidationScenario();

  const stable = captured.map(stabilize);
  const actualJsonl = stable.map((r) => JSON.stringify(r)).join("\n") + "\n";

  if (updateSnapshot) {
    fs.writeFileSync(SNAPSHOT_PATH, actualJsonl, "utf8");
    console.log(`Snapshot updated: ${SNAPSHOT_PATH}`);
    console.log(actualJsonl);
    return;
  }

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    console.error(
      "No snapshot found. Run with --update to create it:\n" +
        "  npx ts-node tasks/lib/action.test.ts --update",
    );
    process.exit(1);
  }

  const expected = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  if (actualJsonl === expected) {
    console.log("OK — action log output matches snapshot");
    console.log(`  ${stable.length} records across 3 scenarios`);
  } else {
    console.error("FAIL — action log output does not match snapshot\n");
    console.error("Expected:");
    console.error(expected);
    console.error("Actual:");
    console.error(actualJsonl);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
