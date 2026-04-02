import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { type CronJob, renderCrontab } from "./render-crontab";

// --- Configuration ---
const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "8080", 10);
const cronConfigPath =
  process.env.CRON_CONFIG_PATH || "/app/cron/cron-jobs.json";
const cronOutputPath = process.env.CRON_OUTPUT_PATH || "/app/cron/cronjob";
const supercronicBin = process.env.SUPERCRONIC_BIN || "supercronic";
const runHistoryLimit = Number.parseInt(
  process.env.ACTION_RUN_HISTORY_LIMIT || "500",
  10
);
const actionApiToken = process.env.ACTION_API_BEARER_TOKEN;
const configuredActionWorkdir = process.env.ACTION_WORKDIR || "/app";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[cron-supervisor] Invalid PORT value "${process.env.PORT}"`);
  process.exit(1);
}
if (!actionApiToken || actionApiToken.trim().length === 0) {
  console.error(
    "[cron-supervisor] ACTION_API_BEARER_TOKEN must be set and non-empty"
  );
  process.exit(1);
}
if (!Number.isInteger(runHistoryLimit) || runHistoryLimit < 1) {
  console.error(
    `[cron-supervisor] Invalid ACTION_RUN_HISTORY_LIMIT value "${process.env.ACTION_RUN_HISTORY_LIMIT}"`
  );
  process.exit(1);
}

const nowIso = () => new Date().toISOString();
const actionWorkdir = fs.existsSync(configuredActionWorkdir)
  ? configuredActionWorkdir
  : process.cwd();

if (!fs.existsSync(configuredActionWorkdir)) {
  console.warn(
    `[cron-supervisor] ACTION_WORKDIR "${configuredActionWorkdir}" does not exist, using "${actionWorkdir}" instead`
  );
}

// --- HTTP helpers ---

function json(
  res: http.ServerResponse,
  statusCode: number,
  payload: any,
  extraHeaders: Record<string, string> = {}
) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

const expectedTokenBuffer = Buffer.from(actionApiToken);
function isAuthorized(headerValue: string | string[] | undefined): boolean {
  if (typeof headerValue !== "string") return false;
  if (!headerValue.startsWith("Bearer ")) return false;
  const providedBuffer = Buffer.from(headerValue.slice(7).trim());
  if (providedBuffer.length !== expectedTokenBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedTokenBuffer);
}

// --- Run tracking ---

interface ActionRun {
  runId: string;
  action: string;
  schedule: string;
  enabled: boolean;
  command?: string;
  status: "queued" | "running" | "succeeded" | "failed";
  queuedAt: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  signal: string | null;
  pid: number | null;
  error?: string;
}

const runStore = new Map<string, ActionRun>();
const runOrder: string[] = [];

function storeRun(run: ActionRun) {
  runStore.set(run.runId, run);
  runOrder.push(run.runId);
  while (runOrder.length > runHistoryLimit) {
    runStore.delete(runOrder.shift()!);
  }
}

// --- Cron setup ---

function initCron() {
  try {
    const result = renderCrontab({
      configPath: cronConfigPath,
      outputPath: cronOutputPath,
    });
    return result;
  } catch (e: any) {
    console.error(`[cron-supervisor] ${e.message}`);
    process.exit(1);
  }
}

const { config: renderedConfig, enabledJobs } = initCron();

console.log(
  `[cron-supervisor] Generated ${enabledJobs.length} enabled cron jobs at ${cronOutputPath}`
);
console.log(`[cron-supervisor] Generated ${cronOutputPath}:`);
console.log(fs.readFileSync(cronOutputPath, "utf8"));

const jobsByName = new Map<string, CronJob>(
  renderedConfig.jobs.map((job) => [job.name, job])
);

// --- Action execution ---

function runAction(action: CronJob, run: ActionRun) {
  run.status = "running";
  run.startedAt = nowIso();
  run.command = action.command;

  console.log(
    `[cron-supervisor] Starting run ${run.runId} for action "${action.name}"`
  );

  const child = spawn("/bin/sh", ["-lc", action.command], {
    cwd: actionWorkdir,
    env: process.env,
    stdio: "inherit",
  });
  run.pid = child.pid ?? null;

  child.on("error", (err) => {
    run.status = "failed";
    run.finishedAt = nowIso();
    run.exitCode = null;
    run.signal = null;
    run.error = err.message;
    console.error(
      `[cron-supervisor] Run ${run.runId} failed to start: ${err.message}`
    );
  });

  child.on("exit", (code, signal) => {
    run.finishedAt = nowIso();
    run.exitCode = code;
    run.signal = signal;
    run.status = code === 0 ? "succeeded" : "failed";
    console.log(
      `[cron-supervisor] Run ${run.runId} for "${action.name}" finished with status=${run.status}, code=${code}, signal=${signal}`
    );
  });
}

function triggerAction(actionName: string): ActionRun | undefined {
  const action = jobsByName.get(actionName);
  if (!action) return undefined;

  const run: ActionRun = {
    runId: randomUUID(),
    action: action.name,
    schedule: action.schedule,
    enabled: action.enabled,
    status: "queued",
    queuedAt: nowIso(),
    startedAt: nowIso(),
    finishedAt: null,
    exitCode: null,
    signal: null,
    pid: null,
  };

  storeRun(run);
  setImmediate(() => runAction(action, run));
  return run;
}

// --- Supercronic process ---

const supercronic = spawn(supercronicBin, [cronOutputPath], {
  env: process.env,
  stdio: "inherit",
});
let supercronicAlive = true;

supercronic.on("error", (err) => {
  console.error(`[cron-supervisor] supercronic start error: ${err.message}`);
  process.exit(1);
});

let shuttingDown = false;
let serverClosed = false;
let supercronicClosed = false;

function maybeExit() {
  if (shuttingDown && serverClosed && supercronicClosed) process.exit(0);
}

supercronic.on("exit", (code, signal) => {
  supercronicAlive = false;
  supercronicClosed = true;
  if (!shuttingDown) {
    console.error(
      `[cron-supervisor] supercronic exited unexpectedly (code=${code}, signal=${signal})`
    );
    process.exit(typeof code === "number" ? code : 1);
  }
  maybeExit();
});

// --- HTTP API ---

const server = http.createServer((req, res) => {
  const method = req.method || "GET";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" && forwardedProto.length > 0
      ? forwardedProto.split(",")[0].trim()
      : "http";
  const reqHost = req.headers.host || `${host}:${port}`;
  const origin = `${proto}://${reqHost}`;
  const url = new URL(req.url || "/", origin);

  // Health check (unauthenticated)
  if (method === "GET" && url.pathname === "/healthz") {
    return json(res, 200, {
      status: "ok",
      api: "up",
      supercronic: { running: supercronicAlive, pid: supercronic.pid ?? null },
    });
  }

  // Auth gate for /api/v1/*
  if (
    url.pathname.startsWith("/api/v1/") &&
    !isAuthorized(req.headers.authorization)
  ) {
    return json(res, 401, { error: "Unauthorized" });
  }

  // List actions
  if (method === "GET" && url.pathname === "/api/v1/actions") {
    return json(res, 200, {
      actions: renderedConfig.jobs.map((job) => ({
        name: job.name,
        schedule: job.schedule,
        enabled: job.enabled,
      })),
    });
  }

  // Trigger action run
  const triggerMatch = url.pathname.match(
    /^\/api\/v1\/actions\/([^/]+)\/runs$/
  );
  if (method === "POST" && triggerMatch) {
    const run = triggerAction(decodeURIComponent(triggerMatch[1]));
    if (!run)
      return json(res, 404, { error: `Unknown action "${triggerMatch[1]}"` });
    const statusUrl = `${origin}/api/v1/runs/${encodeURIComponent(run.runId)}`;
    return json(
      res,
      202,
      {
        runId: run.runId,
        action: run.action,
        status: run.status,
        statusUrl,
        startedAt: run.startedAt,
      },
      { Location: statusUrl }
    );
  }

  // Get run status
  const statusMatch = url.pathname.match(/^\/api\/v1\/runs\/([^/]+)$/);
  if (method === "GET" && statusMatch) {
    const run = runStore.get(decodeURIComponent(statusMatch[1]));
    if (!run) return json(res, 404, { error: `Run not found` });
    return json(res, 200, {
      runId: run.runId,
      action: run.action,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      exitCode: run.exitCode,
      signal: run.signal,
    });
  }

  json(res, 404, { error: "Not found" });
});

server.on("error", (err) => {
  console.error(`[cron-supervisor] HTTP server error: ${err.message}`);
  process.exit(1);
});

server.on("close", () => {
  serverClosed = true;
  maybeExit();
});

// --- Graceful shutdown ---

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[cron-supervisor] Shutting down (signal=${signal})`);
  server.close();

  if (supercronicAlive && supercronic.exitCode === null) {
    supercronic.kill("SIGTERM");
    setTimeout(() => {
      if (supercronic.exitCode === null) supercronic.kill("SIGKILL");
    }, 10_000).unref();
  }

  setTimeout(() => process.exit(0), 12_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(port, host, () => {
  console.log(`[cron-supervisor] API listening on ${host}:${port}`);
});
