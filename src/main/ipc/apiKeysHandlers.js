/**
 * API key management IPC handlers.
 * @module main/ipc/apiKeysHandlers
 */

const { parseOrDefault, schemas } = require('./schemas');
const { withDebugLog } = require('../utils/logger');

const defaultFail = { success: false, error: 'Invalid input' };

/**
 * Register API key IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ apiKeyManager: import('../services/ai/config/apiKeyManager') }} ctx
 */
function register(ipcMain, ctx) {
  const { apiKeyManager } = ctx;

  ipcMain.handle('api-keys:set', withDebugLog('api-keys:set', async (event, provider, apiKey) => {
    const parsed = parseOrDefault(schemas.apiKeysSet, { provider: provider ?? '', apiKey: apiKey ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      apiKeyManager.setAPIKey(parsed.data.provider, parsed.data.apiKey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Set key failed' };
    }
  }));

  ipcMain.handle('api-keys:get', withDebugLog('api-keys:get', async (event, provider) => {
    const parsed = parseOrDefault(schemas.apiKeysProvider, { provider: provider ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const config = apiKeyManager.getProviderConfig(parsed.data.provider);
      return { success: true, data: config ?? null };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Get config failed' };
    }
  }));

  ipcMain.handle('api-keys:has', withDebugLog('api-keys:has', async (event, provider) => {
    const parsed = parseOrDefault(schemas.apiKeysProvider, { provider: provider ?? '' }, defaultFail);
    if (!parsed.ok) return { success: true, hasKey: false };
    try {
      const hasKey = apiKeyManager.hasAPIKey(parsed.data.provider);
      return { success: true, hasKey: !!hasKey };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Check failed', hasKey: false };
    }
  }));

  ipcMain.handle('api-keys:list', withDebugLog('api-keys:list', async () => {
    try {
      const providers = apiKeyManager.getAllProviders();
      const result = {};
      for (const p of providers) {
        result[p] = apiKeyManager.getProviderConfig(p);
      }
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error?.message ?? 'List failed', data: {} };
    }
  }));

  ipcMain.handle('api-keys:remove', withDebugLog('api-keys:remove', async (event, provider) => {
    const parsed = parseOrDefault(schemas.apiKeysProvider, { provider: provider ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      apiKeyManager.removeAPIKey(parsed.data.provider);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Remove failed' };
    }
  }));
}

module.exports = { register };
