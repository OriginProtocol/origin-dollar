import { AsyncLocalStorage } from "node:async_hooks";
import util from "node:util";
import { createLogger, format, transports } from "winston";
import LokiTransport from "winston-loki";

const lokiUrl = process.env.LOKI_URL;
const lokiUser = process.env.LOKI_USER;
const lokiApiKey = process.env.LOKI_API_KEY;
const WINSTON_LOG_MODE_ENABLED_ENV = "WINSTON_LOG_MODE_ENABLED";

const LOG_MODE_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export interface LogContext {
  action?: string;
  run_id?: string;
  [key: string]: unknown;
}

const logContextStorage = new AsyncLocalStorage<LogContext>();

export function isWinstonLogModeEnabled(): boolean {
  const rawValue = process.env[WINSTON_LOG_MODE_ENABLED_ENV];
  if (!rawValue) return false;
  return LOG_MODE_ENABLED_VALUES.has(rawValue.toLowerCase());
}

export function withLogContext<T>(
  context: LogContext,
  fn: () => Promise<T> | T
): Promise<T> | T {
  return logContextStorage.run(context, fn);
}

export function getLogContext(): LogContext | undefined {
  return logContextStorage.getStore();
}

function toMessageString(message: unknown): string {
  if (typeof message === "string") return message;
  return util.format("%o", message);
}

export function logWithContext(
  level: string,
  message: unknown,
  meta: Record<string, unknown> = {}
): void {
  const context = getLogContext() ?? {};
  logger.log(level, toMessageString(message), {
    ...context,
    ...meta,
  });
}

const consoleFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, action, ...rest }) => {
    const prefix = action ? `[${action}] ` : "";
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
    return `${timestamp} ${level}: ${prefix}${message}${extra}`;
  })
);

const logTransports: InstanceType<
  typeof transports.Console | typeof LokiTransport
>[] = [new transports.Console({ format: consoleFormat })];

let lokiTransport: LokiTransport | undefined;
if (lokiUrl) {
  lokiTransport = new LokiTransport({
    host: lokiUrl,
    basicAuth: lokiUrl && lokiApiKey ? `${lokiUser}:${lokiApiKey}` : undefined,
    labels: { app: "origin-dollar" },
    json: true,
    format: format.combine(
      // Promote select low-cardinality fields from metadata to Loki labels.
      // Keep high-cardinality fields (run_id, error_*, duration_ms, chain_id)
      // as JSON fields — they're still queryable via `| json`.
      format((info) => {
        const LABEL_FIELDS = ["action", "event", "source"] as const;
        const labels: Record<string, string> = {};
        for (const k of LABEL_FIELDS) {
          if (info[k]) labels[k] = String(info[k]);
        }
        if (Object.keys(labels).length) {
          info.labels = { ...(info.labels || {}), ...labels };
        }
        return info;
      })(),
      format.json()
    ),
    replaceTimestamp: true,
    batching: true,
    interval: 5,
    onConnectionError: (err: unknown) => {
      console.error("Loki connection error:", err);
    },
  });
  logTransports.push(lokiTransport);
}

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(format.timestamp(), format.errors({ stack: true })),
  transports: logTransports,
});

export async function flushLogger(): Promise<void> {
  await lokiTransport?.flush();
}

export default logger;
