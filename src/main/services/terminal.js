/**
 * Terminal Service
 * Provides a built-in terminal using node-pty.
 * Spawns a platform-appropriate shell and bridges I/O to the renderer.
 */

const os = require('os');
const { EventEmitter } = require('events');

class TerminalService extends EventEmitter {
  constructor() {
    super();
    this.terminals = new Map(); // id -> { pty, cols, rows }
    this._nextId = 1;
    this._pty = null; // Lazy-loaded
  }

  /**
   * Lazy-load node-pty (it's a native module that may fail on some systems).
   * Returns the pty module or null if not available.
   */
  _loadPty() {
    if (this._pty !== null) return this._pty;
    try {
      this._pty = require('node-pty');
    } catch (err) {
      console.warn('node-pty not available — terminal feature disabled:', err.message);
      this._pty = false; // Mark as failed so we don't retry
    }
    return this._pty || null;
  }

  /**
   * Check if terminal support is available.
   */
  isAvailable() {
    return !!this._loadPty();
  }

  /**
   * Create a new terminal instance.
   * @param {Object} options
   * @param {string} [options.cwd] - Working directory
   * @param {number} [options.cols=80] - Column count
   * @param {number} [options.rows=24] - Row count
   * @param {Object} [options.env] - Additional environment variables
   * @returns {{ id: number }} Terminal identifier
   */
  create(options = {}) {
    const pty = this._loadPty();
    if (!pty) {
      throw new Error('Terminal not available: node-pty failed to load');
    }

    const id = this._nextId++;
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const cwd = options.cwd || os.homedir();

    // Pick the right shell for the platform
    const shell = process.platform === 'win32'
      ? 'powershell.exe'
      : (process.env.SHELL || '/bin/bash');

    const shellArgs = process.platform === 'win32' ? [] : ['--login'];

    const env = {
      ...process.env,
      ...options.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    };

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env
    });

    // Forward data from pty to renderer
    ptyProcess.onData((data) => {
      this.emit('data', { id, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.terminals.delete(id);
      this.emit('exit', { id, exitCode, signal });
    });

    this.terminals.set(id, { pty: ptyProcess, cols, rows, cwd });

    return { id };
  }

  /**
   * Write input to a terminal.
   */
  write(id, data) {
    const terminal = this.terminals.get(id);
    if (!terminal) throw new Error(`Terminal ${id} not found`);
    terminal.pty.write(data);
  }

  /**
   * Resize a terminal.
   */
  resize(id, cols, rows) {
    const terminal = this.terminals.get(id);
    if (!terminal) return;
    terminal.pty.resize(cols, rows);
    terminal.cols = cols;
    terminal.rows = rows;
  }

  /**
   * Kill/close a terminal.
   */
  kill(id) {
    const terminal = this.terminals.get(id);
    if (!terminal) return;
    terminal.pty.kill();
    this.terminals.delete(id);
  }

  /**
   * Kill all terminals (cleanup on app quit).
   */
  killAll() {
    for (const [id, terminal] of this.terminals) {
      try { terminal.pty.kill(); } catch (_) { /* ignore */ }
    }
    this.terminals.clear();
  }

  /**
   * Get list of active terminal IDs.
   */
  list() {
    return Array.from(this.terminals.keys()).map(id => {
      const t = this.terminals.get(id);
      return { id, cols: t.cols, rows: t.rows, cwd: t.cwd };
    });
  }
}

module.exports = TerminalService;
