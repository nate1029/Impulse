const fs = require('fs').promises;
const path = require('path');

/**
 * Model Preferences & Usage Store
 *
 * Persists how often each model is actually used, the user's explicitly
 * pinned model (if any), and whether automatic upgrades are enabled.
 * This powers two behaviours:
 *   1. Auto-upgrade: on boot the IDE moves to the newest model of the
 *      provider the user prefers (unless a model is pinned).
 *   2. Most-used: the model with the highest usage count is kept surfaced
 *      so it's always one click away, even after an upgrade.
 *
 * JSON file, no external dependencies (mirrors SimpleMemory).
 */
class ModelPreferences {
  constructor() {
    this.filePath = this._resolvePath();
    this.data = this._defaults();
    this.loaded = false;
  }

  _defaults() {
    return {
      usage: {},               // { [modelId]: count }
      pinnedModel: null,       // user-locked model — never auto-upgraded away
      autoUpgrade: true,       // move to newest model of preferred provider on boot
      preferredProvider: null, // last provider the user manually chose
      updatedAt: 0
    };
  }

  _resolvePath() {
    let appDataDir;
    try {
      const { app } = require('electron');
      if (app && typeof app.getPath === 'function') {
        appDataDir = app.getPath('userData');
      }
    } catch (_) { /* not in Electron */ }
    if (!appDataDir) {
      appDataDir = path.join(
        process.env.APPDATA ||
          (process.platform === 'darwin'
            ? path.join(process.env.HOME, 'Library/Preferences')
            : path.join(process.env.HOME, '.config')),
        'arduino-ide-cursor'
      );
    }
    return path.join(appDataDir, 'model-preferences.json');
  }

  async ensureLoaded() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.data = { ...this._defaults(), ...parsed };
      if (!this.data.usage || typeof this.data.usage !== 'object') {
        this.data.usage = {};
      }
    } catch (_) {
      this.data = this._defaults();
    }
    this.loaded = true;
  }

  async _save() {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      this.data.updatedAt = Date.now();
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (_) { /* best-effort persistence */ }
  }

  /** Record one real use of a model (fire-and-forget from callers). */
  async recordUsage(modelId) {
    if (!modelId || typeof modelId !== 'string') return;
    await this.ensureLoaded();
    this.data.usage[modelId] = (this.data.usage[modelId] || 0) + 1;
    await this._save();
  }

  /** Record which provider the user manually selected a model from. */
  async setPreferredProvider(provider) {
    if (!provider) return;
    await this.ensureLoaded();
    this.data.preferredProvider = provider;
    await this._save();
  }

  /** Pin (lock) a model so auto-upgrade never moves away from it. null unpins. */
  async setPinned(modelId) {
    await this.ensureLoaded();
    this.data.pinnedModel = modelId || null;
    await this._save();
  }

  async setAutoUpgrade(enabled) {
    await this.ensureLoaded();
    this.data.autoUpgrade = !!enabled;
    await this._save();
  }

  /**
   * Most-used model among the ids that still exist in the catalog.
   * @param {string[]} validIds
   * @returns {string|null}
   */
  async getMostUsed(validIds = null) {
    await this.ensureLoaded();
    const entries = Object.entries(this.data.usage);
    let best = null;
    let bestCount = 0;
    for (const [id, count] of entries) {
      if (validIds && !validIds.includes(id)) continue;
      if (count > bestCount) { best = id; bestCount = count; }
    }
    return best;
  }

  async getUsageMap() {
    await this.ensureLoaded();
    return { ...this.data.usage };
  }

  async getState() {
    await this.ensureLoaded();
    return {
      pinnedModel: this.data.pinnedModel,
      autoUpgrade: this.data.autoUpgrade,
      preferredProvider: this.data.preferredProvider,
      usage: { ...this.data.usage }
    };
  }
}

module.exports = ModelPreferences;
