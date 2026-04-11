// Structured log events emitted by the Automaton supervisor.
//
// These helpers exist as a separate module so the exact shape of every
// supervisor-side Loki record can be unit-tested in isolation, without
// having to spawn supercronic or stand up the HTTP server.
//
// Schema is documented in cron/README.md and cron/OBSERVABILITY.md.
// The sibling Automaton in `arm-oeth` emits the same shapes.

import logger, { flushLogger } from "../tasks/lib/logger";

export interface ActionStartFields {
  action: string;
  runId: string;
  schedule: string;
  command: string;
}

export function emitActionStart(f: ActionStartFields): void {
  logger.info(`Started run ${f.runId}`, {
    event: "action.start",
    source: "supervisor",
    action: f.action,
    run_id: f.runId,
    schedule: f.schedule,
    command: f.command,
  });
}

export interface ActionExitFields {
  action: string;
  runId: string;
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export function emitActionExit(f: ActionExitFields): void {
  const success = f.exitCode === 0;
  const event = success ? "action.success" : "action.failure";
  const msg = success
    ? `Completed in ${(f.durationMs / 1000).toFixed(1)}s`
    : `Failed after ${(f.durationMs / 1000).toFixed(1)}s (exit=${f.exitCode}${f.signal ? `, signal=${f.signal}` : ""})`;
  logger[success ? "info" : "error"](msg, {
    event,
    source: "supervisor",
    action: f.action,
    run_id: f.runId,
    duration_ms: f.durationMs,
    exit_code: f.exitCode,
    signal: f.signal,
  });
}

export interface SpawnFailureFields {
  action: string;
  runId: string;
  durationMs: number;
  errorMessage: string;
}

export function emitSpawnFailure(f: SpawnFailureFields): void {
  logger.error(`Failed to spawn: ${f.errorMessage}`, {
    event: "action.failure",
    source: "supervisor",
    action: f.action,
    run_id: f.runId,
    duration_ms: f.durationMs,
    spawn_failed: true,
    error_message: f.errorMessage,
  });
}

export { flushLogger };
