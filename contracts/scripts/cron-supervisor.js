#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { randomUUID, timingSafeEqual } = require("node:crypto");
const { renderCrontab } = require("./render-crontab");

const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "8080", 10);
const cronConfigPath =
  process.env.CRON_CONFIG_PATH || "/app/cron/cron-jobs.json";
const cronOutputPath = process.env.CRON_OUTPUT_PATH || "/etc/cronjob";
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

const json = (res, statusCode, payload, extraHeaders = {}) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
};

const expectedTokenBuffer = Buffer.from(actionApiToken);
const isAuthorized = (headerValue) => {
  if (typeof headerValue !== "string") {
    return false;
  }
  const prefix = "Bearer ";
  if (!headerValue.startsWith(prefix)) {
    return false;
  }
  const provided = headerValue.slice(prefix.length).trim();
  const providedBuffer = Buffer.from(provided);
  if (providedBuffer.length !== expectedTokenBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedTokenBuffer);
};

const runStore = new Map();
const runOrder = [];
const storeRun = (run) => {
  runStore.set(run.runId, run);
  runOrder.push(run.runId);
  while (runOrder.length > runHistoryLimit) {
    const removedRunId = runOrder.shift();
    runStore.delete(removedRunId);
  }
};

let renderedConfig;
let enabledJobs;
try {
  const renderResult = renderCrontab({
    configPath: cronConfigPath,
    outputPath: cronOutputPath,
  });
  renderedConfig = renderResult.config;
  enabledJobs = renderResult.enabledJobs;
} catch (error) {
  console.error(`[cron-supervisor] ${error.message}`);
  process.exit(1);
}

console.log(
  `[cron-supervisor] Generated ${enabledJobs.length} enabled cron jobs at ${cronOutputPath}`
);
console.log("[cron-supervisor] Generated /etc/cronjob:");
console.log(fs.readFileSync(cronOutputPath, "utf8"));

const jobsByName = new Map(
  renderedConfig.jobs.map((job) => {
    return [job.name, job];
  })
);

const runAction = (action, run) => {
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

  child.on("error", (error) => {
    run.status = "failed";
    run.finishedAt = nowIso();
    run.exitCode = null;
    run.signal = null;
    run.error = error.message;
    console.error(
      `[cron-supervisor] Run ${run.runId} failed to start: ${error.message}`
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
};

const triggerAction = (actionName) => {
  const action = jobsByName.get(actionName);
  if (!action) {
    return undefined;
  }

  const run = {
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
};

let supercronic = spawn(supercronicBin, [cronOutputPath], {
  env: process.env,
  stdio: "inherit",
});
let supercronicAlive = true;

supercronic.on("error", (error) => {
  console.error(`[cron-supervisor] supercronic start error: ${error.message}`);
  process.exit(1);
});

let shuttingDown = false;
let serverClosed = false;
let supercronicClosed = false;
const maybeExit = () => {
  if (shuttingDown && serverClosed && supercronicClosed) {
    process.exit(0);
  }
};

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

const server = http.createServer((req, res) => {
  const method = req.method || "GET";
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwardedProto === "string" && forwardedProto.length > 0
      ? forwardedProto.split(",")[0].trim()
      : "http";
  const reqHost = req.headers.host || `${host}:${port}`;
  const origin = `${proto}://${reqHost}`;
  const requestUrl = new URL(req.url || "/", origin);

  if (method === "GET" && requestUrl.pathname === "/healthz") {
    json(res, 200, {
      status: "ok",
      api: "up",
      supercronic: {
        running: supercronicAlive,
        pid: supercronic.pid ?? null,
      },
    });
    return;
  }

  if (requestUrl.pathname.startsWith("/api/v1/")) {
    if (!isAuthorized(req.headers.authorization)) {
      json(res, 401, { error: "Unauthorized" });
      return;
    }
  }

  if (method === "GET" && requestUrl.pathname === "/api/v1/actions") {
    json(res, 200, {
      actions: renderedConfig.jobs.map((job) => ({
        name: job.name,
        schedule: job.schedule,
        enabled: job.enabled,
      })),
    });
    return;
  }

  const runTriggerMatch = requestUrl.pathname.match(
    /^\/api\/v1\/actions\/([^/]+)\/runs$/
  );
  if (method === "POST" && runTriggerMatch) {
    const actionName = decodeURIComponent(runTriggerMatch[1]);
    const run = triggerAction(actionName);
    if (!run) {
      json(res, 404, { error: `Unknown action "${actionName}"` });
      return;
    }

    const statusUrl = `${origin}/api/v1/runs/${encodeURIComponent(run.runId)}`;
    json(
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
    return;
  }

  const runStatusMatch = requestUrl.pathname.match(
    /^\/api\/v1\/runs\/([^/]+)$/
  );
  if (method === "GET" && runStatusMatch) {
    const runId = decodeURIComponent(runStatusMatch[1]);
    const run = runStore.get(runId);
    if (!run) {
      json(res, 404, { error: `Run "${runId}" not found` });
      return;
    }

    json(res, 200, {
      runId: run.runId,
      action: run.action,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      exitCode: run.exitCode,
      signal: run.signal,
    });
    return;
  }

  if (requestUrl.pathname.startsWith("/api/v1/")) {
    json(res, 404, { error: "Not found" });
    return;
  }

  json(res, 404, { error: "Not found" });
});

server.on("error", (error) => {
  console.error(`[cron-supervisor] HTTP server error: ${error.message}`);
  process.exit(1);
});

server.on("close", () => {
  serverClosed = true;
  maybeExit();
});

const shutdown = (signal) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  console.log(`[cron-supervisor] Shutting down (signal=${signal})`);
  server.close();

  if (supercronicAlive && supercronic.exitCode === null) {
    supercronic.kill("SIGTERM");
    setTimeout(() => {
      if (supercronic.exitCode === null) {
        supercronic.kill("SIGKILL");
      }
    }, 10_000).unref();
  }

  setTimeout(() => {
    process.exit(0);
  }, 12_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(port, host, () => {
  console.log(`[cron-supervisor] API listening on ${host}:${port}`);
});
