/**
 * Arduino CLI IPC handlers (compile, upload, boards, ports).
 * @module main/ipc/arduinoHandlers
 */

const { parseOrDefault, schemas } = require('./schemas');
const { withDebugLog } = require('../utils/logger');

const defaultFail = { success: false, error: 'Invalid input' };

/**
 * Register Arduino CLI IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ arduinoService: import('../services/arduinoService'), errorMemory: import('../services/errorMemory') }} ctx
 */
function register(ipcMain, ctx) {
  const { arduinoService, errorMemory } = ctx;

  ipcMain.handle('arduino:compile', withDebugLog('arduino:compile', async (event, sketchPath, boardFQBN) => {
    const parsed = parseOrDefault(schemas.arduinoCompile, { sketchPath: sketchPath ?? '', boardFQBN: boardFQBN ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const result = await arduinoService.compile(parsed.data.sketchPath, parsed.data.boardFQBN);
      return { success: true, data: result };
    } catch (error) {
      const analyzedError = await errorMemory.analyzeError(error).catch(() => null);
      return { success: false, error: error?.message ?? 'Compile failed', analyzedError };
    }
  }));

  ipcMain.handle('arduino:upload', withDebugLog('arduino:upload', async (event, sketchPath, boardFQBN, port) => {
    const parsed = parseOrDefault(schemas.arduinoUpload, { sketchPath: sketchPath ?? '', boardFQBN: boardFQBN ?? '', port: port ?? '' }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      const result = await arduinoService.upload(parsed.data.sketchPath, parsed.data.boardFQBN, parsed.data.port);
      return { success: true, data: result };
    } catch (error) {
      const analyzedError = await errorMemory.analyzeError(error).catch(() => null);
      return { success: false, error: error?.message ?? 'Upload failed', analyzedError };
    }
  }));

  ipcMain.handle('arduino:list-boards', withDebugLog('arduino:list-boards', async () => {
    try {
      const boards = await arduinoService.listBoards();
      return { success: true, data: boards ?? [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Failed to list boards' };
    }
  }));

  ipcMain.handle('arduino:list-ports', withDebugLog('arduino:list-ports', async () => {
    try {
      const ports = await arduinoService.listPorts();
      return { success: true, data: ports ?? [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Failed to list ports' };
    }
  }));

  ipcMain.handle('arduino:check-cli', withDebugLog('arduino:check-cli', async () => {
    try {
      const installed = await arduinoService.checkCLI();
      return { success: true, installed: !!installed };
    } catch (error) {
      return { success: false, error: error?.message ?? 'CLI check failed', installed: false };
    }
  }));

  // Board Manager: core search, list, install, uninstall
  ipcMain.handle('arduino:core-search', withDebugLog('arduino:core-search', async (event, keyword) => {
    try {
      const list = await arduinoService.coreSearch(keyword ?? '');
      return { success: true, data: Array.isArray(list) ? list : [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Core search failed', data: [] };
    }
  }));

  ipcMain.handle('arduino:core-list', withDebugLog('arduino:core-list', async () => {
    try {
      const list = await arduinoService.coreList();
      return { success: true, data: Array.isArray(list) ? list : [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Core list failed', data: [] };
    }
  }));

  ipcMain.handle('arduino:core-install', withDebugLog('arduino:core-install', async (event, coreId) => {
    const id = coreId ?? '';
    if (!id || typeof id !== 'string') return { success: false, error: 'Core ID required' };
    try {
      await arduinoService.coreInstall(id.trim());
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Core install failed' };
    }
  }));

  ipcMain.handle('arduino:core-uninstall', withDebugLog('arduino:core-uninstall', async (event, coreId) => {
    const id = coreId ?? '';
    if (!id || typeof id !== 'string') return { success: false, error: 'Core ID required' };
    try {
      await arduinoService.coreUninstall(id.trim());
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Core uninstall failed' };
    }
  }));

  // Examples (from installed libraries / cores)
  ipcMain.handle('arduino:lib-examples', withDebugLog('arduino:lib-examples', async (event, libraryName) => {
    try {
      const list = await arduinoService.libExamples(libraryName ?? '');
      return { success: true, data: Array.isArray(list) ? list : [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Examples list failed', data: [] };
    }
  }));

  ipcMain.handle('arduino:lib-examples-with-paths', withDebugLog('arduino:lib-examples-with-paths', async (event, libraryFilter) => {
    try {
      const list = await arduinoService.libExamplesWithPaths(libraryFilter ?? '');
      return { success: true, data: Array.isArray(list) ? list : [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Examples list failed', data: [] };
    }
  }));
}

module.exports = { register };
