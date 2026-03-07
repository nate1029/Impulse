/**
 * App-level IPC handlers (quit).
 * @module main/ipc/appHandlers
 */

/**
 * Register app IPC handlers.
 * @param {import('electron').IpcMain} ipcMain
 * @param {{ app: import('electron').App } } ctx
 */
function register(ipcMain, ctx) {
  const { app } = ctx;
  ipcMain.on('app:quit', () => app.quit());
}

module.exports = { register };
