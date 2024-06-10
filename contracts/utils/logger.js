const debug = require("debug");

// https://www.npmjs.com/package/debug#output-streams
// set all output to go via console.log instead of stderr
// This is needed for Defender Actions to capture the logs
debug.log = console.log.bind(console);

/**
 * Creates a logger for a module.
 * @example
 *   const log = require("../utils/logger")("test:fork:vault");
 *   log('something interesting happened');
 * @param {string} module name of the module to log for. eg "test:fork:vault", "task:token" or "utils:deploy"
 */
const logger = (module) => debug(`origin:${module}`);

module.exports = logger;
