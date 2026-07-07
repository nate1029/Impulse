/**
 * Serial monitor IPC handlers.
 * @module main/ipc/serialHandlers
 */

const { parseOrDefault, schemas } = require('./schemas');
const { withDebugLog } = require('../utils/logger');

const defaultFail = { success: false, error: 'Invalid input' };

/**
 * Register serial monitor IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ serialMonitor: import('../services/serialMonitor'), uiState: Record<string, unknown> }} ctx
 */
function register(ipcMain, ctx) {
  const { serialMonitor, uiState } = ctx;

  ipcMain.handle('serial:connect', withDebugLog('serial:connect', async (event, port, baudRate) => {
    const parsed = parseOrDefault(schemas.serialConnect, { port: port ?? '', baudRate }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      await serialMonitor.connect(parsed.data.port, parsed.data.baudRate ?? 115200);
      uiState.currentBaudRate = parsed.data.baudRate ?? 115200;
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Connect failed' };
    }
  }));

  ipcMain.handle('serial:disconnect', withDebugLog('serial:disconnect', async () => {
    try {
      await serialMonitor.disconnect();
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Disconnect failed' };
    }
  }));

  ipcMain.handle('serial:send', withDebugLog('serial:send', async (event, data) => {
    const parsed = parseOrDefault(schemas.serialSend, { data }, defaultFail);
    if (!parsed.ok) return parsed.defaultResult;
    try {
      await serialMonitor.send(parsed.data.data ?? '');
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Send failed' };
    }
  }));

  ipcMain.handle('serial:list-ports', withDebugLog('serial:list-ports', async () => {
    try {
      const ports = await serialMonitor.listPorts();
      return { success: true, data: ports ?? [] };
    } catch (error) {
      return { success: false, error: error?.message ?? 'Failed to list ports' };
    }
  }));
}

module.exports = { register };
