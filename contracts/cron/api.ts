import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import http from "node:http";
import type { Logger } from "winston";
import type { CronJob } from "./render-crontab";

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

// --- API ---

export interface ApiOpts {
  host: string;
  port: number;
  apiToken: string;
  jobs: CronJob[];
  jobsByName: Map<string, CronJob>;
  workdir: string;
  historyLimit: number;
  healthCheck: () => { running: boolean; pid: number | null };
  log: Logger;
}

export function createApi(opts: ApiOpts): http.Server {
  const {
    host,
    port,
    apiToken,
    jobs,
    jobsByName,
    workdir,
    historyLimit,
    healthCheck,
    log,
  } = opts;

  const nowIso = () => new Date().toISOString();

  // --- Run store ---

  const runStore = new Map<string, ActionRun>();
  const runOrder: string[] = [];

  function storeRun(run: ActionRun) {
    runStore.set(run.runId, run);
    runOrder.push(run.runId);
    while (runOrder.length > historyLimit) {
      runStore.delete(runOrder.shift()!);
    }
  }

  // --- Action execution ---

  function runAction(action: CronJob, run: ActionRun) {
    run.status = "running";
    run.startedAt = nowIso();
    run.command = action.command;

    log.info(`Starting run ${run.runId} for "${action.name}"`);

    const child = spawn("/bin/sh", ["-lc", action.command], {
      cwd: workdir,
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
      log.error(`Run ${run.runId} failed to spawn: ${err.message}`);
    });

    child.on("exit", (code, signal) => {
      run.finishedAt = nowIso();
      run.exitCode = code;
      run.signal = signal;
      run.status = code === 0 ? "succeeded" : "failed";
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

  // --- HTTP helpers ---

  function json(
    res: http.ServerResponse,
    statusCode: number,
    payload: any,
    extraHeaders: Record<string, string> = {},
  ) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      ...extraHeaders,
    });
    res.end(JSON.stringify(payload));
  }

  const expectedTokenBuffer = Buffer.from(apiToken);
  function isAuthorized(headerValue: string | string[] | undefined): boolean {
    if (typeof headerValue !== "string") return false;
    if (!headerValue.startsWith("Bearer ")) return false;
    const providedBuffer = Buffer.from(headerValue.slice(7).trim());
    if (providedBuffer.length !== expectedTokenBuffer.length) return false;
    return timingSafeEqual(providedBuffer, expectedTokenBuffer);
  }

  // --- Server ---

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
      const health = healthCheck();
      return json(res, 200, {
        status: "ok",
        api: "up",
        supercronic: { running: health.running, pid: health.pid },
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
        actions: jobs.map((job) => ({
          name: job.name,
          schedule: job.schedule,
          enabled: job.enabled,
        })),
      });
    }

    // Trigger action run
    const triggerMatch = url.pathname.match(
      /^\/api\/v1\/actions\/([^/]+)\/runs$/,
    );
    if (method === "POST" && triggerMatch) {
      const run = triggerAction(decodeURIComponent(triggerMatch[1]));
      if (!run)
        return json(res, 404, {
          error: `Unknown action "${triggerMatch[1]}"`,
        });
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
        { Location: statusUrl },
      );
    }

    // Get run status
    const statusMatch = url.pathname.match(/^\/api\/v1\/runs\/([^/]+)$/);
    if (method === "GET" && statusMatch) {
      const run = runStore.get(decodeURIComponent(statusMatch[1]));
      if (!run) return json(res, 404, { error: "Run not found" });
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
    log.error(`HTTP server error: ${err.message}`);
    process.exit(1);
  });

  return server;
}
