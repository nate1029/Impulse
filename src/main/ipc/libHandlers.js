/**
 * Library manager IPC handlers (search, install, list, uninstall, update index).
 * @module main/ipc/libHandlers
 */

const { parseOrDefault, schemas } = require('./schemas');
const { withDebugLog } = require('../utils/logger');

const defaultFail = { success: false, error: 'Invalid input' };

/**
 * Register library IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ arduinoService: import('../services/arduinoService') }} ctx
 */
function register(ipcMain, ctx) {
  const { arduinoService } = ctx;

  ipcMain.handle('lib:search', withDebugLog('lib:search', async (event, query) => {
    const parsed = parseOrDefault(schemas.libSearch, { query: query ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const data = await arduinoService.libSearch(parsed.data.query ?? '');
      return { success: true, data: data ?? {} };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Search failed' };
    }
  }));

  ipcMain.handle('lib:install', withDebugLog('lib:install', async (event, libSpec) => {
    const parsed = parseOrDefault(schemas.libInstall, { libSpec: libSpec ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      await arduinoService.libInstall(parsed.data.libSpec);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Install failed' };
    }
  }));

  ipcMain.handle('lib:list', withDebugLog('lib:list', async () => {
    try {
      const data = await arduinoService.libList();
      return { success: true, data: data ?? {} };
    } catch (error) {
      return { success: false, error: error?.message ?? 'List failed' };
    }
  }));

  ipcMain.handle('lib:update-index', withDebugLog('lib:update-index', async () => {
    try {
      await arduinoService.libUpdateIndex();
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Update index failed' };
    }
  }));

  ipcMain.handle('lib:uninstall', withDebugLog('lib:uninstall', async (event, libName) => {
    const parsed = parseOrDefault(schemas.libUninstall, { libName: libName ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      await arduinoService.libUninstall(parsed.data.libName);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Uninstall failed' };
    }
  }));
}

module.exports = { register };
