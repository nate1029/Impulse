/**
 * App-level IPC handlers (quit, clipboard).
 * @module main/ipc/appHandlers
 */

const { clipboard } = require('electron');

/**
 * Register app IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ app: import('electron').App } } ctx
 */
function register(ipcMain, ctx) {
  const { app } = ctx;
  ipcMain.on('app:quit', () => app.quit());

  // Clipboard bridge — renderer text fields need real paste (execCommand('paste')
  // is a no-op in Electron renderers, and the Edit-menu accelerator swallows Cmd+V).
  ipcMain.handle('clipboard:read-text', () => clipboard.readText());
  ipcMain.handle('clipboard:write-text', (event, text) => {
    if (typeof text === 'string' && text.length <= 1_000_000) clipboard.writeText(text);
    return true;
  });
}

module.exports = { register };
