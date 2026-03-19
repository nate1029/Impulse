/**
 * UI state update IPC handlers (sync from renderer to main).
 * @module main/ipc/uiHandlers
 */

const UI_STATE_KEYS = ['currentBaudRate', 'currentSketchPath', 'selectedBoard', 'selectedPort', 'editorCode'];

/**
 * Register UI state IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ uiState: Record<string, unknown> }} ctx
 */
function register(ipcMain, ctx) {
  const { uiState } = ctx;

  ipcMain.on('ui:update-state', (event, key, value) => {
    if (key && UI_STATE_KEYS.includes(key)) {
      uiState[key] = value;
    }
  });

  ipcMain.on('ui:update-editor-code', (event, code) => {
    uiState.editorCode = typeof code === 'string' ? code : String(code ?? '');
  });

  ipcMain.on('ui:update-sketch-path', (event, path) => {
    uiState.currentSketchPath = typeof path === 'string' ? path : null;
  });

  ipcMain.on('ui:update-baud-rate', (event, baudRate) => {
    const n = Number(baudRate);
    uiState.currentBaudRate = Number.isInteger(n) && n >= 300 && n <= 2000000 ? n : 115200;
  });

  ipcMain.on('ui:update-board', (event, board) => {
    uiState.selectedBoard = board != null ? String(board) : null;
  });

  ipcMain.on('ui:update-port', (event, port) => {
    uiState.selectedPort = port != null ? String(port) : null;
  });
}

module.exports = { register };
