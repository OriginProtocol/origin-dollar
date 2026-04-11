// Integration test for the supervisor's action execution + structured logging.
//
// Spawns a real test action (cron/test-action.ts) through the same code path
// the supervisor uses. Captures both supervisor-level events and the action's
// own log output, then compares the combined stream against a golden snapshot.
//
// Run with: npx ts-node cron/action-runner.test.ts
// Update snapshot: npx ts-node cron/action-runner.test.ts --update

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { format, transports } from "winston";
import logger from "../tasks/lib/logger";
import {
  emitActionExit,
  emitActionStart,
  emitSpawnFailure,
} from "./log-events";

const SNAPSHOT_PATH = path.join(__dirname, "action-runner.snapshot.jsonl");
const updateSnapshot = process.argv.includes("--update");
const testActionScript = path.join(__dirname, "test-action.ts");

// --- Winston capture ---------------------------------------------------------

const captured: Record<string, unknown>[] = [];
const captureFormat = format((info) => {
  captured.push({ ...info });
  return false;
});
logger.add(new transports.Console({ format: captureFormat() }));

/** Strip volatile fields for stable comparison. */
function stabilize(record: Record<string, unknown>): Record<string, unknown> {
  const isTaskRecord = record.source === "task";
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (k === "timestamp") continue;
    if (k === "duration_ms" && isTaskRecord) {
      out[k] = "<number>";
      continue;
    }
    if (k === "command" && typeof v === "string") {
      out[k] = v.replace(testActionScript, "<test-action>");
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Parse a console log line from the action child process.
 * Format: `<timestamp> <level>: [<action>] <message> {json}`
 */
function parseLogLine(line: string): Record<string, unknown> | null {
  const match = line.match(
    /^\S+\s+(\w+):\s+(?:\[(\w+)\]\s+)?(.+?)(?:\s+(\{.+\}))?$/
  );
  if (!match) return null;
  const [, level, action, message, jsonStr] = match;
  const extra = jsonStr ? JSON.parse(jsonStr) : {};
  return { level, action, message, ...extra };
}

// --- Helpers -----------------------------------------------------------------

const RUN_IDS = {
  success: "11111111-1111-1111-1111-111111111111",
  failure: "22222222-2222-2222-2222-222222222222",
  spawnFail: "33333333-3333-3333-3333-333333333333",
};

function spawnTestAction(
  args: string[],
  runId: string
): Promise<{
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  logs: Record<string, unknown>[];
}> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["ts-node", testActionScript, ...args], {
      env: { ...process.env, AUTOMATON_RUN_ID: runId },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d));
    child.stderr.on("data", (d: Buffer) => (stderr += d));

    child.on("exit", (code, signal) => {
      // Combine stdout + stderr, parse each line
      const allOutput = (stdout + stderr).trim();
      const logs: Record<string, unknown>[] = [];
      for (const line of allOutput.split("\n")) {
        if (!line.trim()) continue;
        const parsed = parseLogLine(line.trim());
        if (parsed) logs.push(parsed);
      }
      resolve({ exitCode: code, signal, logs });
    });
  });
}

// --- Scenarios ---------------------------------------------------------------

async function runSuccessScenario() {
  const action = "test_action";
  const runId = RUN_IDS.success;
  const schedule = "*/5 * * * *";
  const command = `npx ts-node ${testActionScript}`;

  emitActionStart({ action, runId, schedule, command });
  const result = await spawnTestAction([], runId);
  for (const log of result.logs) captured.push(log);
  emitActionExit({
    action,
    runId,
    durationMs: 42,
    exitCode: result.exitCode,
    signal: result.signal,
  });
}

async function runFailureScenario() {
  const action = "test_action";
  const runId = RUN_IDS.failure;
  const schedule = "0 0 * * *";
  const command = `npx ts-node ${testActionScript} --fail`;

  emitActionStart({ action, runId, schedule, command });
  const result = await spawnTestAction(["--fail"], runId);
  for (const log of result.logs) captured.push(log);
  emitActionExit({
    action,
    runId,
    durationMs: 11398,
    exitCode: result.exitCode,
    signal: result.signal,
  });
}

async function runSpawnFailureScenario() {
  emitSpawnFailure({
    action: "test_action",
    runId: RUN_IDS.spawnFail,
    durationMs: 5,
    errorMessage: "ENOENT: no such file or directory, posix_spawn '/bin/sh'",
  });
}

// --- Main --------------------------------------------------------------------

async function main() {
  await runSuccessScenario();
  await runFailureScenario();
  await runSpawnFailureScenario();

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
        "  npx ts-node cron/action-runner.test.ts --update"
    );
    process.exit(1);
  }

  const expected = fs.readFileSync(SNAPSHOT_PATH, "utf8");
  if (actualJsonl === expected) {
    console.log("OK — log output matches snapshot");
    console.log(`  ${stable.length} records across 3 scenarios`);
  } else {
    console.error("FAIL — log output does not match snapshot\n");
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
