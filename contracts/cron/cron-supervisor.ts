import { spawn } from "node:child_process";
import fs from "node:fs";
import baseLogger, { flushLogger } from "../tasks/lib/logger";
import { getNoncePool } from "../tasks/lib/nonceQueue";
import { createApi } from "./api";
import { cronJobs } from "./cron-jobs";
import { renderCrontab } from "./render-crontab";

const log = baseLogger.child({ source: "supervisor" });

// --- Configuration ---

const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "8080", 10);
const cronOutputPath = process.env.CRON_OUTPUT_PATH || "/app/cron/cronjob";
const supercronicBin = process.env.SUPERCRONIC_BIN || "supercronic";
const runHistoryLimit = Number.parseInt(
  process.env.ACTION_RUN_HISTORY_LIMIT || "500",
  10,
);
const actionApiToken = process.env.ACTION_API_BEARER_TOKEN;
const configuredActionWorkdir = process.env.ACTION_WORKDIR || "/app";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  log.error(`Invalid PORT value "${process.env.PORT}"`);
  process.exit(1);
}
if (!actionApiToken || actionApiToken.trim().length === 0) {
  log.error("ACTION_API_BEARER_TOKEN must be set and non-empty");
  process.exit(1);
}
if (!Number.isInteger(runHistoryLimit) || runHistoryLimit < 1) {
  log.error(
    `Invalid ACTION_RUN_HISTORY_LIMIT value "${process.env.ACTION_RUN_HISTORY_LIMIT}"`,
  );
  process.exit(1);
}

const actionWorkdir = fs.existsSync(configuredActionWorkdir)
  ? configuredActionWorkdir
  : process.cwd();

if (!fs.existsSync(configuredActionWorkdir)) {
  log.warn(
    `ACTION_WORKDIR "${configuredActionWorkdir}" does not exist, using "${actionWorkdir}" instead`,
  );
}

// --- Cron setup ---

function initCron() {
  try {
    return renderCrontab({ jobs: cronJobs, outputPath: cronOutputPath });
  } catch (e: any) {
    log.error(e.message);
    process.exit(1);
  }
}

const { jobs: allJobs, enabledJobs } = initCron();

log.info(
  `Generated ${enabledJobs.length} enabled cron jobs at ${cronOutputPath}`,
);
log.info(
  `Generated ${cronOutputPath}:\n${fs.readFileSync(cronOutputPath, "utf8")}`,
);

// --- Supercronic ---

const supercronic = spawn(supercronicBin, [cronOutputPath], {
  env: process.env,
  stdio: "inherit",
});
let supercronicAlive = true;

supercronic.on("error", (err) => {
  log.error(`supercronic start error: ${err.message}`);
  process.exit(1);
});

// --- API server ---

const jobsByName = new Map(allJobs.map((job) => [job.name, job]));
const server = createApi({
  host,
  port,
  apiToken: actionApiToken,
  jobs: allJobs,
  jobsByName,
  workdir: actionWorkdir,
  historyLimit: runHistoryLimit,
  healthCheck: () => ({
    running: supercronicAlive,
    pid: supercronic.pid ?? null,
  }),
  log,
});

server.listen(port, host, () => {
  log.info(`API listening on ${host}:${port}`);
});

// --- Graceful shutdown ---

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
    log.error(
      `supercronic exited unexpectedly (code=${code}, signal=${signal})`,
    );
    process.exit(typeof code === "number" ? code : 1);
  }
  maybeExit();
});

server.on("close", () => {
  serverClosed = true;
  maybeExit();
});

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  log.info(`Shutting down (signal=${signal})`);
  try {
    await flushLogger();
  } catch (err: any) {
    log.error(`flushLogger failed: ${err?.message}`);
  }
  try {
    const pool = getNoncePool();
    if (pool) await pool.end();
  } catch (err: any) {
    log.error(`noncePool close failed: ${err?.message}`);
  }
  server.close();

  if (supercronicAlive && supercronic.exitCode === null) {
    supercronic.kill("SIGTERM");
    setTimeout(() => {
      if (supercronic.exitCode === null) supercronic.kill("SIGKILL");
    }, 10_000).unref();
  }

  setTimeout(() => process.exit(0), 12_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
