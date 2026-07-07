/**
 * Simple logger with DEBUG flag. When DEBUG is set, logs function entry/exit and variable values.
 * Set IMPULSE_IDE_DEBUG=1 in environment to enable.
 * @module main/utils/logger
 */

const DEBUG = process.env.IMPULSE_IDE_DEBUG === '1' || process.env.IMPULSE_IDE_DEBUG === 'true';

/**
 * Internal log helper. Always logs (respects level).
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [vars]
 */
function _log(level, message, vars = undefined) {
  const payload = vars ? ` ${JSON.stringify(vars)}` : '';
  const fn = console[level] || console.log;
  fn.call(console, `[ImpulseIDE] ${message}${payload}`);
}

/**
 * Log a debug message and optional payload. No-op when DEBUG is false.
 * @param {string} message - Log message (e.g. "ipc:arduino:compile entry")
 * @param {Record<string, unknown>} [vars] - Optional key/value object to log (e.g. { sketchPath, boardFQBN })
 */
function debug(message, vars = undefined) {
  if (!DEBUG) return;
  _log('debug', message, vars);
}

/**
 * Log an info message.
 */
function info(message, vars = undefined) {
  _log('info', message, vars);
}

/**
 * Log a warning message.
 */
function warn(message, vars = undefined) {
  _log('warn', message, vars);
}

/**
 * Log an error message. Always logs regardless of DEBUG flag.
 */
function error(message, vars = undefined) {
  _log('error', message, vars);
}

/**
 * Wrap an async handler to log entry/exit and elapsed time when DEBUG is set.
 * @param {string} label - Handler label (e.g. "arduino:compile")
 * @param {(...args: unknown[]) => Promise<{ success: boolean }>} handler - Async IPC handler
 * @returns {(...args: unknown[]) => Promise<{ success: boolean }>} Wrapped handler
 */
function withDebugLog(label, handler) {
  return async (...args) => {
    if (!DEBUG) return handler(...args);
    const start = Date.now();
    debug(`${label} entry`, { args: args?.length });
    try {
      const result = await handler(...args);
      debug(`${label} exit`, { durationMs: Date.now() - start, success: result?.success });
      return result;
    } catch (err) {
      debug(`${label} error`, { durationMs: Date.now() - start, error: err?.message });
      throw err;
    }
  };
}

module.exports = { DEBUG, debug, info, warn, error, withDebugLog };
