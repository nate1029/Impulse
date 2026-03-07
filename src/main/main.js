/**
 * Impulse IDE (Arduino IDE Cursor) - Electron main process.
 * Creates window, initializes services, and registers IPC handlers.
 */

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

process.on('uncaughtException', (err) => {
  fs.writeFileSync('crash.log', err ? err.stack : 'Unknown error');
  console.error(err);
});
process.on('unhandledRejection', (reason) => {
  fs.writeFileSync('crash.log', reason ? (reason.stack || reason.toString()) : 'Unknown reason');
  console.error(reason);
});
const fsp = require('fs').promises;
const ArduinoService = require('./services/arduinoService');
const SerialMonitor = require('./services/serialMonitor');
const ErrorMemory = require('./services/errorMemory');
const AIAgent = require('./services/ai/agent');
const APIKeyManager = require('./services/ai/config/apiKeyManager');
const { registerAllIpc } = require('./ipc');
const { debug } = require('./utils/logger');
const notifications = require('./utils/notifications');
const TerminalService = require('./services/terminal');
const PluginManager = require('./services/pluginManager');
const CollaborationService = require('./services/collaboration');

let mainWindow;
let arduinoService;
let serialMonitor;
let errorMemory;
let aiAgent;
let apiKeyManager;
let terminalService;

const uiState = {
  currentBaudRate: 115200,
  currentSketchPath: null,
  selectedBoard: null,
  selectedPort: null,
  editorCode: ''
};

/**
 * Create the main application window and menu.
 */
function createWindow() {
  const assetsDir = path.join(__dirname, '../../assets');
  let iconPath = path.join(assetsDir, 'wave-square-solid.svg');
  if (process.platform === 'win32') {
    const icoPath = path.join(assetsDir, 'icon.ico');
    const pngPath = path.join(assetsDir, 'icon.png');
    if (fs.existsSync(icoPath)) iconPath = icoPath;
    else if (fs.existsSync(pngPath)) iconPath = pngPath;
  }
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    // Open DevTools once after the renderer is attached.
    // Calling openDevTools() twice can crash on some Electron/Windows builds.
    mainWindow.webContents.once('did-finish-load', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      } catch (err) {
        console.warn('Failed to open DevTools:', err.message);
      }
    });
  }

  // Load the renderer:
  // - Dev mode (--dev): connect to Vite dev server for HMR
  // - Production / start: load from Vite-built output (dist-renderer/)
  const distRenderer = path.join(__dirname, '../../dist-renderer/index.html');

  if (isDev) {
    // In dev mode, Vite dev server must be running (npm run dev:renderer)
    const VITE_DEV_URL = process.env.VITE_DEV_URL || 'http://localhost:5173';
    mainWindow.loadURL(VITE_DEV_URL).catch(() => {
      // Fallback: if Vite dev server isn't running, load the built version
      if (fs.existsSync(distRenderer)) {
        mainWindow.loadFile(distRenderer);
      } else {
        // Last resort: show an error instead of a white screen
        mainWindow.loadURL(`data:text/html,<h2 style="font-family:sans-serif;padding:40px">Renderer not built.</h2><p style="font-family:sans-serif;padding:0 40px">Run <code>npm run build:renderer</code> first, or start the Vite dev server with <code>npm run dev:renderer</code>.</p>`);
      }
    });
  } else if (fs.existsSync(distRenderer)) {
    mainWindow.loadFile(distRenderer);
  } else {
    // Production but dist missing -- show actionable error
    mainWindow.loadURL(`data:text/html,<h2 style="font-family:sans-serif;padding:40px">Renderer not built.</h2><p style="font-family:sans-serif;padding:0 40px">Run <code>npm run build:renderer</code> to build the UI.</p>`);
  }

  // --- Content Security Policy ---
  // Block eval, inline scripts, and restrict origins to what the app actually needs.
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
            "img-src 'self' data:",
            "object-src 'none'",
            "base-uri 'self'"
          ].join('; ')
        ]
      }
    });
  });

  const sendMenuAction = (action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('menu:action', action);
    }
  };

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Sketch', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('file-new') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('file-open') },
        { label: 'Open Folder...', click: () => sendMenuAction('file-open-folder') },
        { label: 'Examples', click: () => sendMenuAction('file-examples') },
        { label: 'Sketchbook', click: () => sendMenuAction('file-sketchbook') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('file-save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('file-save-as') },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => sendMenuAction('file-preferences') },
        { type: 'separator' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', click: () => sendMenuAction('file-close') },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => sendMenuAction('file-quit') }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendMenuAction('edit-undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => sendMenuAction('edit-redo') },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', click: () => sendMenuAction('edit-cut') },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', click: () => sendMenuAction('edit-copy') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', click: () => sendMenuAction('edit-paste') },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => sendMenuAction('edit-select-all') },
        { type: 'separator' },
        { label: 'Go to Line...', accelerator: 'CmdOrCtrl+L', click: () => sendMenuAction('edit-goto-line') },
        { label: 'Comment/Uncomment', accelerator: 'CmdOrCtrl+/', click: () => sendMenuAction('edit-comment') },
        { label: 'Increase Indent', click: () => sendMenuAction('edit-increase-indent') },
        { label: 'Decrease Indent', click: () => sendMenuAction('edit-decrease-indent') },
        { label: 'Auto Format', accelerator: 'CmdOrCtrl+T', click: () => sendMenuAction('edit-format') },
        { type: 'separator' },
        { label: 'Find', accelerator: 'CmdOrCtrl+F', click: () => sendMenuAction('edit-find') },
        { label: 'Find Next', accelerator: 'CmdOrCtrl+G', click: () => sendMenuAction('edit-find-next') },
        { label: 'Find Previous', accelerator: 'CmdOrCtrl+Shift+G', click: () => sendMenuAction('edit-find-prev') },
        { type: 'separator' },
        { label: 'Increase Font Size', accelerator: 'CmdOrCtrl+=', click: () => sendMenuAction('edit-font-increase') },
        { label: 'Decrease Font Size', accelerator: 'CmdOrCtrl+-', click: () => sendMenuAction('edit-font-decrease') }
      ]
    },
    {
      label: 'Sketch',
      submenu: [
        { label: 'Verify/Compile', accelerator: 'CmdOrCtrl+R', click: () => sendMenuAction('sketch-verify') },
        { label: 'Upload', accelerator: 'CmdOrCtrl+U', click: () => sendMenuAction('sketch-upload') },
        { label: 'Upload Using Programmer', accelerator: 'CmdOrCtrl+Shift+U', click: () => sendMenuAction('sketch-upload-programmer') },
        { type: 'separator' },
        { label: 'Export Compiled Binary', accelerator: 'Alt+Ctrl+S', click: () => sendMenuAction('sketch-export-binary') },
        { label: 'Show Sketch Folder', accelerator: 'Alt+Ctrl+K', click: () => sendMenuAction('sketch-show-folder') },
        { type: 'separator' },
        { label: 'Include Library', click: () => sendMenuAction('sketch-include-library') },
        { label: 'Add Tab', click: () => sendMenuAction('sketch-add-tab') },
        { label: 'Add File...', click: () => sendMenuAction('sketch-add-file') }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Auto Format', accelerator: 'CmdOrCtrl+T', click: () => sendMenuAction('tools-format') },
        { label: 'Archive Sketch', click: () => sendMenuAction('tools-archive') },
        { type: 'separator' },
        { label: 'Manage Libraries...', accelerator: 'CmdOrCtrl+Shift+I', click: () => sendMenuAction('tools-manage-libs') },
        { label: 'Serial Monitor', accelerator: 'CmdOrCtrl+Shift+M', click: () => sendMenuAction('tools-serial-monitor') },
        { label: 'Serial Plotter', click: () => sendMenuAction('tools-serial-plotter') },
        { type: 'separator' },
        { label: 'Board', click: () => sendMenuAction('tools-board') },
        { label: 'Port', click: () => sendMenuAction('tools-port') },
        { label: 'Reload Board Data', click: () => sendMenuAction('tools-reload-boards') },
        { label: 'Get Board Info', click: () => sendMenuAction('tools-get-board-info') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Getting Started', click: () => sendMenuAction('help-getting-started') },
        { label: 'Environment', click: () => sendMenuAction('help-environment') },
        { label: 'Troubleshooting', click: () => sendMenuAction('help-troubleshooting') },
        { label: 'Reference', click: () => sendMenuAction('help-reference') },
        { label: 'Find in Reference', accelerator: 'CmdOrCtrl+Shift+F', click: () => sendMenuAction('help-find-reference') },
        { type: 'separator' },
        { label: 'Frequently Asked Questions', click: () => sendMenuAction('help-faq') },
        { label: 'Visit Arduino.cc', click: () => sendMenuAction('help-visit-arduino') },
        { type: 'separator' },
        { label: 'About Arduino IDE', click: () => sendMenuAction('help-about') }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

}

app.whenReady().then(() => {
  debug('app.whenReady', {});
  arduinoService = new ArduinoService();
  serialMonitor = new SerialMonitor();
  errorMemory = new ErrorMemory();
  apiKeyManager = new APIKeyManager();
  aiAgent = new AIAgent(arduinoService, serialMonitor, errorMemory);
  aiAgent.initializeProviders();

  if (aiAgent.toolExecutor) {
    aiAgent.toolExecutor.setUICallbacks({
      getBaudRate: async () => uiState.currentBaudRate,
      setBaudRate: async (baudRate) => {
        uiState.currentBaudRate = baudRate;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ui:set-baud-rate', baudRate);
        }
      },
      getEditorCode: async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          return new Promise((resolve) => {
            let done = false;
            const finish = (code) => { if (!done) { done = true; resolve(code ?? ''); } };
            // Use ipcMain.once (event listener) instead of handleOnce (handler)
            // to avoid deadlock when multiple AI requests run concurrently.
            ipcMain.once('ui:editor-code-response', (_event, code) => finish(code));
            mainWindow.webContents.send('ui:get-editor-code');
            setTimeout(() => finish(uiState.editorCode), 1000);
          });
        }
        return uiState.editorCode || '';
      },
      setEditorCode: async (code) => {
        uiState.editorCode = code;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ui:set-editor-code', code);
        }
      },
      getCurrentSketchPath: async () => uiState.currentSketchPath,
      saveSketch: async (filePath) => {
        const p = filePath || uiState.currentSketchPath;
        if (p && uiState.editorCode) {
          await fsp.writeFile(p, uiState.editorCode, 'utf8');
        }
      },
      getSelectedBoard: async () => uiState.selectedBoard,
      getSelectedPort: async () => uiState.selectedPort,
      setPlayground: async (content, append) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('playground:update', content, append);
        }
      }
    });
  }

  serialMonitor.on('data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('serial:data', data);
  });
  serialMonitor.on('error', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('serial:error', error?.message ?? '');
  });
  serialMonitor.on('connected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('serial:connected');
  });
  serialMonitor.on('disconnected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('serial:disconnected');
  });
  serialMonitor.on('reconnecting', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('serial:reconnecting', info);
  });
  serialMonitor.on('reconnected', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('serial:reconnected', info);
  });
  serialMonitor.on('reconnect-failed', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('serial:reconnect-failed', info);
  });

  createWindow();

  // Set up notification manager
  notifications.setMainWindow(mainWindow);

  // Auto-updater (check for updates 5s after launch, then every 4 hours)
  let updaterService = null;
  try {
    const AutoUpdaterService = require('./services/autoUpdater');
    updaterService = new AutoUpdaterService(mainWindow);
    setTimeout(() => updaterService.checkForUpdates(), 5000);
    setInterval(() => updaterService.checkForUpdates(), 4 * 60 * 60 * 1000);

    ipcMain.handle('updater:check', async () => updaterService.checkForUpdates());
    ipcMain.handle('updater:download', async () => updaterService.downloadUpdate());
    ipcMain.handle('updater:install', () => updaterService.quitAndInstall());
  } catch (err) {
    // Auto-updater may not work in dev mode — register safe no-op handlers
    // so the renderer doesn't crash with "No handler registered" errors.
    console.warn('Auto-updater not available:', err.message);
    ipcMain.handle('updater:check', async () => ({ available: false }));
    ipcMain.handle('updater:download', async () => ({ success: false, error: 'Updater not available' }));
    ipcMain.handle('updater:install', () => ({ success: false, error: 'Updater not available' }));
  }

  // Terminal service
  terminalService = new TerminalService();
  terminalService.on('data', ({ id, data }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:data', id, data);
    }
  });
  terminalService.on('exit', ({ id, exitCode }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:exit', id, exitCode);
    }
  });

  // Terminal IPC handlers
  ipcMain.handle('terminal:available', () => terminalService.isAvailable());
  ipcMain.handle('terminal:create', (_event, options) => terminalService.create(options));
  ipcMain.handle('terminal:write', (_event, id, data) => { terminalService.write(id, data); });
  ipcMain.handle('terminal:resize', (_event, id, cols, rows) => { terminalService.resize(id, cols, rows); });
  ipcMain.handle('terminal:kill', (_event, id) => { terminalService.kill(id); });
  ipcMain.handle('terminal:list', () => terminalService.list());

  // Plugin system — use Electron userData for portable installs (dev and packaged)
  const appDataPath = app.getPath('userData');
  const pluginManager = new PluginManager(appDataPath);
  pluginManager.initialize().catch(err => console.warn('Plugin init:', err.message));

  // Collaboration service
  const collaboration = new CollaborationService();
  collaboration.on('peer-joined', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('collab:peer-joined', info);
  });
  collaboration.on('peer-left', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('collab:peer-left', info);
  });
  collaboration.on('awareness-update', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('collab:awareness', info);
  });

  // Collaboration IPC — wrapped with try/catch because y-webrtc requires
  // browser WebRTC APIs that don't exist in the main process. Each handler
  // returns a safe error instead of crashing.
  const collabNotReady = { success: false, error: 'Collaboration not yet supported in this version' };
  ipcMain.handle('collab:create-room', async (_event, content, userName) => {
    try { return await collaboration.createRoom(content, userName); }
    catch (e) { return { ...collabNotReady, detail: e.message }; }
  });
  ipcMain.handle('collab:join-room', async (_event, roomId, userName) => {
    try { return await collaboration.joinRoom(roomId, userName); }
    catch (e) { return { ...collabNotReady, detail: e.message }; }
  });
  ipcMain.handle('collab:leave-room', async () => {
    try { return await collaboration.leaveRoom(); }
    catch (_) { return collabNotReady; }
  });
  ipcMain.handle('collab:apply-change', (_event, index, deleteCount, insertText) => {
    try { collaboration.applyLocalChange(index, deleteCount, insertText); }
    catch (_) { /* silent */ }
  });
  ipcMain.handle('collab:get-text', () => {
    try { return collaboration.getText(); } catch (_) { return ''; }
  });
  ipcMain.handle('collab:get-peers', () => {
    try { return collaboration.getPeers(); } catch (_) { return []; }
  });
  ipcMain.handle('collab:get-status', () => {
    try { return collaboration.getStatus(); }
    catch (_) { return { connected: false, roomId: null, peerCount: 0 }; }
  });
  ipcMain.handle('collab:update-cursor', (_event, pos, selStart, selEnd) => {
    try { collaboration.updateCursor(pos, selStart, selEnd); }
    catch (_) { /* silent */ }
  });
  ipcMain.handle('collab:observe', () => {
    try {
      collaboration.observeChanges((change) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('collab:remote-change', change);
        }
      });
    } catch (_) { /* silent */ }
  });

  ipcMain.handle('plugins:list', () => pluginManager.listPlugins());
  ipcMain.handle('plugins:commands', () => pluginManager.getRegisteredCommands());
  ipcMain.handle('plugins:execute-command', (_event, cmdId, ...args) => pluginManager.executeCommand(cmdId, ...args));
  ipcMain.handle('plugins:boards', () => pluginManager.getContributedBoards());

  const ctx = {
    mainWindow,
    arduinoService,
    serialMonitor,
    errorMemory,
    aiAgent,
    apiKeyManager,
    uiState,
    fsp,
    path,
    dialog,
    shell,
    app
  };
  registerAllIpc(ipcMain, ctx);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // Clean up terminal processes
  if (terminalService) {
    try { terminalService.killAll(); } catch (_) { /* ignore */ }
  }
});
