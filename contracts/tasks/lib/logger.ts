import { createLogger, format, transports } from "winston";
import LokiTransport from "winston-loki";

const lokiUrl = process.env.LOKI_URL;
const lokiUser = process.env.LOKI_USER;
const lokiApiKey = process.env.LOKI_API_KEY;

const logTransports: InstanceType<
  typeof transports.Console | typeof LokiTransport
>[] = [new transports.Console()];

if (lokiUrl) {
  logTransports.push(
    new LokiTransport({
      host: lokiUrl,
      basicAuth:
        lokiUser && lokiApiKey ? `${lokiUser}:${lokiApiKey}` : undefined,
      labels: { app: "origin-dollar" },
      json: true,
      replaceTimestamp: true,
      onConnectionError: (err: Error) => {
        console.error("Loki connection error:", err.message);
      },
    })
  );
}

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, action, ...rest }) => {
      const prefix = action ? `[${action}] ` : "";
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
      return `${timestamp} ${level}: ${prefix}${message}${extra}`;
    })
  ),
  transports: logTransports,
});

export default logger;
