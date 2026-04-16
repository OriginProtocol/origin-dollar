import { spawn } from "node:child_process";
import { randomUUID, timingSafeEqual } from "node:crypto";
import http from "node:http";
import type { Logger } from "winston";
import { getNoncePool } from "../tasks/lib/nonceQueue";
import { listNonceQueueTransactions } from "../tasks/lib/nonceQueueTxHistory";
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

function parsePositiveIntParam(
  value: string | null,
  {
    fallback,
    minimum,
    maximum,
  }: { fallback: number; minimum: number; maximum: number }
): number | null {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) return null;
  return Math.min(parsed, maximum);
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
    const startedAtMs = Date.now();
    let terminalEventEmitted = false;

    log.info(`Starting run ${run.runId} for "${action.name}"`, {
      event: "action.start",
      source: "supervisor",
      action: action.name,
      run_id: run.runId,
      schedule: action.schedule,
      command: action.command,
    });

    const child = spawn("/bin/sh", ["-lc", action.command], {
      cwd: workdir,
      env: {
        ...process.env,
        ACTION_RUN_ID: run.runId,
        ACTION_NAME: action.name,
      },
      stdio: "inherit",
    });
    run.pid = child.pid ?? null;

    child.on("error", (err) => {
      run.status = "failed";
      run.finishedAt = nowIso();
      run.exitCode = null;
      run.signal = null;
      run.error = err.message;
      if (terminalEventEmitted) return;
      terminalEventEmitted = true;
      log.error(`Run ${run.runId} failed to spawn: ${err.message}`, {
        event: "action.failure",
        source: "supervisor",
        action: action.name,
        run_id: run.runId,
        schedule: action.schedule,
        command: action.command,
        duration_ms: Date.now() - startedAtMs,
        exit_code: null,
        signal: null,
        spawn_failed: true,
        error_name: err?.name ?? "Error",
        error_message: err?.message ?? String(err),
      });
    });

    child.on("exit", (code, signal) => {
      run.finishedAt = nowIso();
      run.exitCode = code;
      run.signal = signal;
      run.status = code === 0 ? "succeeded" : "failed";
      if (terminalEventEmitted) return;
      terminalEventEmitted = true;
      const terminalMeta = {
        event: code === 0 ? "action.success" : "action.failure",
        source: "supervisor",
        action: action.name,
        run_id: run.runId,
        schedule: action.schedule,
        command: action.command,
        duration_ms: Date.now() - startedAtMs,
        exit_code: code,
        signal,
        spawn_failed: false,
      };
      if (code === 0) {
        log.info(`Run ${run.runId} completed successfully`, terminalMeta);
      } else {
        log.error(
          `Run ${run.runId} failed (exit_code=${code}, signal=${signal})`,
          terminalMeta
        );
      }
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
    extraHeaders: Record<string, string> = {}
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

    if (method === "GET" && url.pathname === "/api/v1/transactions") {
      const limit = parsePositiveIntParam(url.searchParams.get("limit"), {
        fallback: 50,
        minimum: 1,
        maximum: 500,
      });
      if (limit === null) {
        return json(res, 400, {
          error: "Invalid limit (expected integer >= 1)",
        });
      }

      const addressParam = url.searchParams.get("address");
      const normalizedAddress =
        addressParam && addressParam.trim().length > 0
          ? addressParam.trim().toLowerCase()
          : undefined;
      const chainIdParam = url.searchParams.get("chainId");
      let parsedChainId: number | undefined;
      if (chainIdParam !== null && chainIdParam.trim().length > 0) {
        const candidate = Number(chainIdParam);
        if (!Number.isInteger(candidate) || candidate < 0) {
          return json(res, 400, {
            error: "Invalid chainId (expected integer >= 0)",
          });
        }
        parsedChainId = candidate;
      }

      const noncePool = getNoncePool();
      if (!noncePool) {
        return json(res, 200, { transactions: [] });
      }

      void listNonceQueueTransactions({
        pool: noncePool,
        params: {
          limit,
          address: normalizedAddress,
          chainId: parsedChainId,
        },
      })
        .then((transactions) => {
          json(res, 200, { transactions });
        })
        .catch((err: any) => {
          log.error(
            `Failed to list nonce queue transactions: ${
              err?.message ?? String(err)
            }`
          );
          json(res, 500, { error: "Internal server error" });
        });
      return;
    }

    // Trigger action run
    const triggerMatch = url.pathname.match(
      /^\/api\/v1\/actions\/([^/]+)\/runs$/
    );
    if (method === "POST" && triggerMatch) {
      const run = triggerAction(decodeURIComponent(triggerMatch[1]));
      if (!run)
        return json(res, 404, {
          error: `Unknown action "${triggerMatch[1]}"`,
        });
      const statusUrl = `${origin}/api/v1/runs/${encodeURIComponent(
        run.runId
      )}`;
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
