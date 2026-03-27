import { createLogger, format, transports } from "winston";
import LokiTransport from "winston-loki";

const lokiUrl = process.env.LOKI_URL;
const lokiUser = process.env.LOKI_USER;
const lokiApiKey = process.env.LOKI_API_KEY;

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
    format: format.json(),
    replaceTimestamp: true,
    batching: true,
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
