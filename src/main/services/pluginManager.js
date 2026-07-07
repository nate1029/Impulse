/**
 * Plugin Manager
 * Foundation for the Impulse IDE extension system.
 * 
 * Plugins are directories containing a manifest.json and entry JS file.
 * They can:
 *   - Register custom board definitions
 *   - Add tool integrations (compilers, linters, formatters)
 *   - Extend the AI system with custom tools
 *   - Add commands accessible from the command palette
 * 
 * Plugin directory: {appData}/impulse-ide/plugins/{plugin-name}/
 * 
 * manifest.json:
 * {
 *   "name": "my-plugin",
 *   "version": "1.0.0",
 *   "displayName": "My Plugin",
 *   "description": "Does something cool",
 *   "main": "index.js",
 *   "contributes": {
 *     "boards": [...],
 *     "commands": [...],
 *     "tools": [...]
 *   }
 * }
 */

const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');

class PluginManager extends EventEmitter {
  constructor(appDataPath) {
    super();
    this.pluginsDir = path.join(appDataPath, 'impulse-ide', 'plugins');
    this.plugins = new Map();       // name -> { manifest, instance, status }
    this.boards = new Map();        // fqbn -> board definition (contributed by plugins)
    this.commands = new Map();      // commandId -> { handler, plugin }
    this.tools = new Map();         // toolName -> { handler, plugin }
    this._initialized = false;
  }

  /**
   * Initialize the plugin system. Creates the plugins directory if needed.
   */
  async initialize() {
    if (this._initialized) return;
    try {
      await fs.mkdir(this.pluginsDir, { recursive: true });
      await this._discoverPlugins();
      this._initialized = true;
      this.emit('initialized', { pluginCount: this.plugins.size });
    } catch (err) {
      console.error('Plugin system initialization failed:', err.message);
    }
  }

  /**
   * Discover and load all plugins from the plugins directory.
   */
  async _discoverPlugins() {
    let entries;
    try {
      entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
    } catch (_) {
      return; // No plugins directory
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        await this._loadPlugin(entry.name);
      } catch (err) {
        console.warn(`Failed to load plugin "${entry.name}":`, err.message);
        this.plugins.set(entry.name, {
          manifest: { name: entry.name },
          instance: null,
          status: 'error',
          error: err.message
        });
      }
    }
  }

  /**
   * Load a single plugin by directory name.
   */
  async _loadPlugin(dirName) {
    const pluginDir = path.join(this.pluginsDir, dirName);
    const manifestPath = path.join(pluginDir, 'manifest.json');

    // Read and validate manifest
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);

    if (!manifest.name || !manifest.version) {
      throw new Error('manifest.json must have "name" and "version" fields');
    }

    // Create the plugin API surface (sandbox)
    const api = this._createPluginAPI(manifest.name);

    // Load the entry point
    let instance = null;
    if (manifest.main) {
      const entryPath = path.join(pluginDir, manifest.main);
      // Clear require cache to allow reloading
      delete require.cache[require.resolve(entryPath)];
      const pluginModule = require(entryPath);

      if (typeof pluginModule.activate === 'function') {
        instance = await pluginModule.activate(api);
      }
    }

    // Register contributed boards
    if (manifest.contributes?.boards) {
      for (const board of manifest.contributes.boards) {
        if (board.fqbn && board.name) {
          this.boards.set(board.fqbn, { ...board, plugin: manifest.name });
        }
      }
    }

    // Register contributed commands
    if (manifest.contributes?.commands) {
      for (const cmd of manifest.contributes.commands) {
        if (cmd.id && instance && typeof instance[cmd.handler || cmd.id] === 'function') {
          this.commands.set(cmd.id, {
            handler: instance[cmd.handler || cmd.id].bind(instance),
            plugin: manifest.name,
            title: cmd.title || cmd.id
          });
        }
      }
    }

    this.plugins.set(manifest.name, {
      manifest,
      instance,
      status: 'active',
      dir: pluginDir
    });

    this.emit('plugin-loaded', { name: manifest.name, version: manifest.version });
  }

  /**
   * Create the sandboxed API that plugins receive in their activate() function.
   */
  _createPluginAPI(pluginName) {
    const self = this;

    return {
      /**
       * Register a custom board definition.
       */
      registerBoard(fqbn, boardDef) {
        self.boards.set(fqbn, { ...boardDef, fqbn, plugin: pluginName });
        self.emit('board-registered', { fqbn, plugin: pluginName });
      },

      /**
       * Register a command that can be executed from the command palette.
       */
      registerCommand(commandId, handler, title = '') {
        self.commands.set(commandId, { handler, plugin: pluginName, title });
        self.emit('command-registered', { commandId, plugin: pluginName });
      },

      /**
       * Register a tool that the AI agent can use.
       */
      registerTool(toolName, toolDef) {
        self.tools.set(toolName, { ...toolDef, plugin: pluginName });
        self.emit('tool-registered', { toolName, plugin: pluginName });
      },

      /**
       * Log a message from the plugin.
       */
      log(message) {
        console.log(`[Plugin:${pluginName}] ${message}`);
      },

      /**
       * Get the plugin's own data directory.
       */
      getDataDir() {
        return path.join(self.pluginsDir, pluginName, 'data');
      }
    };
  }

  /**
   * Execute a registered command by ID.
   */
  async executeCommand(commandId, ...args) {
    const cmd = this.commands.get(commandId);
    if (!cmd) throw new Error(`Command "${commandId}" not found`);
    return await cmd.handler(...args);
  }

  /**
   * Get all contributed boards (for board list).
   */
  getContributedBoards() {
    return Array.from(this.boards.values());
  }

  /**
   * Get all registered commands (for command palette).
   */
  getRegisteredCommands() {
    return Array.from(this.commands.entries()).map(([id, cmd]) => ({
      id,
      title: cmd.title,
      plugin: cmd.plugin
    }));
  }

  /**
   * Get all registered tools (for AI agent).
   */
  getRegisteredTools() {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description || '',
      parameters: tool.parameters || {},
      plugin: tool.plugin
    }));
  }

  /**
   * Get plugin info for all loaded plugins.
   */
  listPlugins() {
    return Array.from(this.plugins.entries()).map(([name, p]) => ({
      name,
      version: p.manifest.version,
      displayName: p.manifest.displayName || name,
      description: p.manifest.description || '',
      status: p.status,
      error: p.error
    }));
  }

  /**
   * Unload a plugin by name.
   */
  async unloadPlugin(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    // Call deactivate if available
    if (plugin.instance && typeof plugin.instance.deactivate === 'function') {
      try {
        await plugin.instance.deactivate();
      } catch (_) { /* ignore */ }
    }

    // Remove contributed boards, commands, tools
    for (const [fqbn, board] of this.boards) {
      if (board.plugin === name) this.boards.delete(fqbn);
    }
    for (const [cmdId, cmd] of this.commands) {
      if (cmd.plugin === name) this.commands.delete(cmdId);
    }
    for (const [toolName, tool] of this.tools) {
      if (tool.plugin === name) this.tools.delete(toolName);
    }

    this.plugins.delete(name);
    this.emit('plugin-unloaded', { name });
  }
}

module.exports = PluginManager;
