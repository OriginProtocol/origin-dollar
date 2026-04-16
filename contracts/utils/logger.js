const debug = require("debug");
const util = require("node:util");

// https://www.npmjs.com/package/debug#output-streams
// set all output to go via console.log instead of stderr
// This is needed for Defender Actions to capture the logs
debug.log = console.log.bind(console);

const LOG_MODE_ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

const isWinstonLogModeEnabled = () => {
  const rawValue = process.env.WINSTON_LOG_MODE_ENABLED;
  if (!rawValue) return false;
  return LOG_MODE_ENABLED_VALUES.has(rawValue.toLowerCase());
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  Object.getPrototypeOf(value) === Object.prototype;

const formatArgs = (args) => {
  if (args.length === 0) return "";
  if (typeof args[0] === "string") {
    return util.format(...args);
  }
  return args
    .map((arg) =>
      typeof arg === "string" ? arg : util.inspect(arg, { depth: null })
    )
    .join(" ");
};

const parseLogArguments = (args) => {
  if (
    args.length === 2 &&
    typeof args[0] === "string" &&
    isPlainObject(args[1])
  ) {
    return {
      message: args[0],
      meta: args[1],
    };
  }

  return {
    message: formatArgs(args),
    meta: {},
  };
};

const createDebugLogger = (module) => {
  const debugLogger = debug(`origin:${module}`);

  const write = (...args) => {
    const { message, meta } = parseLogArguments(args);
    const extra =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    debugLogger(`${message}${extra}`);
  };

  const logger = (...args) => write(...args);
  logger.debug = (...args) => write(...args);
  logger.info = (...args) => write(...args);
  logger.warn = (...args) => write(...args);
  logger.error = (...args) => write(...args);
  logger.child = () => logger;
  return logger;
};

const createWinstonLogger = (module) => {
  let bridge;
  try {
    // ts-node is registered by hardhat and cron entrypoints.
    bridge = require("../tasks/lib/logger");
  } catch (err) {
    const fallback = createDebugLogger(module);
    fallback(
      `Failed to load winston bridge; falling back to debug logger: ${
        err?.message ?? String(err)
      }`
    );
    return fallback;
  }

  const write = (level, ...args) => {
    const { message, meta } = parseLogArguments(args);
    bridge.logWithContext(level, message, { module, ...meta });
  };

  const logger = (...args) => write("info", ...args);
  logger.debug = (...args) => write("debug", ...args);
  logger.info = (...args) => write("info", ...args);
  logger.warn = (...args) => write("warn", ...args);
  logger.error = (...args) => write("error", ...args);
  logger.child = (meta = {}) => {
    const childLogger = (...args) => {
      const { message, meta: inlineMeta } = parseLogArguments(args);
      bridge.logWithContext("info", message, {
        module,
        ...meta,
        ...inlineMeta,
      });
    };
    childLogger.debug = (...args) => {
      const { message, meta: inlineMeta } = parseLogArguments(args);
      bridge.logWithContext("debug", message, {
        module,
        ...meta,
        ...inlineMeta,
      });
    };
    childLogger.info = (...args) => {
      const { message, meta: inlineMeta } = parseLogArguments(args);
      bridge.logWithContext("info", message, {
        module,
        ...meta,
        ...inlineMeta,
      });
    };
    childLogger.warn = (...args) => {
      const { message, meta: inlineMeta } = parseLogArguments(args);
      bridge.logWithContext("warn", message, {
        module,
        ...meta,
        ...inlineMeta,
      });
    };
    childLogger.error = (...args) => {
      const { message, meta: inlineMeta } = parseLogArguments(args);
      bridge.logWithContext("error", message, {
        module,
        ...meta,
        ...inlineMeta,
      });
    };
    childLogger.child = () => childLogger;
    return childLogger;
  };
  return logger;
};

/**
 * Creates a logger for a module.
 * @example
 *   const log = require("../utils/logger")("test:fork:vault");
 *   log('something interesting happened');
 * @param {string} module name of the module to log for. eg "test:fork:vault", "task:token" or "utils:deploy"
 */
const logger = (module) =>
  isWinstonLogModeEnabled()
    ? createWinstonLogger(module)
    : createDebugLogger(module);

module.exports = logger;
