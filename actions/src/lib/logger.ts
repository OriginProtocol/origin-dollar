import { createLogger, format, transports } from "winston";

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, action, ...rest }) => {
      const prefix = action ? `[${action}] ` : "";
      const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
      return `${timestamp} ${level}: ${prefix}${message}${extra}`;
    }),
  ),
  transports: [new transports.Console()],
});

export default logger;
