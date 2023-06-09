const debug = require("debug");

/**
 * Creates a logger for a module.
 * @example
 *   const log = require("../utils/logger")("test:fork:vault");
 *   log('something interesting happened');
 * @param {string} module name of the module to log for. eg "test:fork:vault", "task:token" or "utils:deploy"
 */
const logger = (module) => debug(`origin:${module}`);

module.exports = logger;
