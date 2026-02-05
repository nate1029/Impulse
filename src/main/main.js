const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const ArduinoService = require('./services/arduinoService');
const SerialMonitor = require('./services/serialMonitor');
const ErrorMemory = require('./services/errorMemory');
const AIAgent = require('./services/ai/agent');
const APIKeyManager = require('./services/ai/config/apiKeyManager');

let mainWindow;
let arduinoService;
let serialMonitor;
let errorMemory;
let aiAgent;
let apiKeyManager;

// Store for UI state that renderer will update
let uiState = {
  currentBaudRate: 115200,
  currentSketchPath: null,
  selectedBoard: null,
  selectedPort: null,
  editorCode: ''
};

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: iconPath
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Native application menu (File, Edit, Sketch, Tools, Help) — not next to board/port
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

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Initialize services
  arduinoService = new ArduinoService();
  serialMonitor = new SerialMonitor();
  errorMemory = new ErrorMemory();
  
  // Initialize AI Agent
  apiKeyManager = new APIKeyManager();
  aiAgent = new AIAgent(arduinoService, serialMonitor, errorMemory);
  aiAgent.initializeProviders();

  // Set up UI callbacks for the tool executor
  if (aiAgent.toolExecutor) {
    aiAgent.toolExecutor.setUICallbacks({
      getBaudRate: async () => uiState.currentBaudRate,
      setBaudRate: async (baudRate) => {
        uiState.currentBaudRate = baudRate;
        // Notify renderer to update UI
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ui:set-baud-rate', baudRate);
        }
      },
      getEditorCode: async () => {
        // Request code from renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          return new Promise((resolve) => {
            const handler = (event, code) => {
              ipcMain.removeHandler('ui:editor-code-response');
              resolve(code);
            };
            ipcMain.handleOnce('ui:editor-code-response', handler);
            mainWindow.webContents.send('ui:get-editor-code');
            
            // Timeout fallback
            setTimeout(() => {
              resolve(uiState.editorCode || '');
            }, 1000);
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
      saveSketch: async (path) => {
        const filePath = path || uiState.currentSketchPath;
        if (filePath && uiState.editorCode) {
          const fs = require('fs').promises;
          await fs.writeFile(filePath, uiState.editorCode, 'utf8');
        }
      },
      getSelectedBoard: async () => uiState.selectedBoard,
      getSelectedPort: async () => uiState.selectedPort
    });
  }

  // Set up serial monitor event listeners after initialization
  serialMonitor.on('data', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:data', data);
    }
  });

  serialMonitor.on('error', (error) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:error', error.message);
    }
  });

  serialMonitor.on('connected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:connected');
    }
  });

  serialMonitor.on('disconnected', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('serial:disconnected');
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// UI State Update IPC Handlers
ipcMain.on('ui:update-state', (event, key, value) => {
  if (key in uiState) {
    uiState[key] = value;
  }
});

ipcMain.on('ui:update-editor-code', (event, code) => {
  uiState.editorCode = code;
});

ipcMain.on('ui:update-sketch-path', (event, path) => {
  uiState.currentSketchPath = path;
});

ipcMain.on('ui:update-baud-rate', (event, baudRate) => {
  uiState.currentBaudRate = baudRate;
});

ipcMain.on('ui:update-board', (event, board) => {
  uiState.selectedBoard = board;
});

ipcMain.on('ui:update-port', (event, port) => {
  uiState.selectedPort = port;
});

ipcMain.on('app:quit', () => {
  app.quit();
});

ipcMain.handle('shell:open-external', async (event, url) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false };
});

// Arduino CLI IPC Handlers
ipcMain.handle('arduino:compile', async (event, sketchPath, boardFQBN) => {
  try {
    const result = await arduinoService.compile(sketchPath, boardFQBN);
    return { success: true, data: result };
  } catch (error) {
    const analyzedError = await errorMemory.analyzeError(error);
    return { success: false, error: error.message, analyzedError };
  }
});

ipcMain.handle('arduino:upload', async (event, sketchPath, boardFQBN, port) => {
  try {
    const result = await arduinoService.upload(sketchPath, boardFQBN, port);
    return { success: true, data: result };
  } catch (error) {
    const analyzedError = await errorMemory.analyzeError(error);
    return { success: false, error: error.message, analyzedError };
  }
});

ipcMain.handle('arduino:list-boards', async () => {
  try {
    const boards = await arduinoService.listBoards();
    return { success: true, data: boards };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('arduino:list-ports', async () => {
  try {
    const ports = await arduinoService.listPorts();
    return { success: true, data: ports };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('arduino:check-cli', async () => {
  try {
    const installed = await arduinoService.checkCLI();
    return { success: true, installed };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Serial Monitor IPC Handlers
ipcMain.handle('serial:connect', async (event, port, baudRate) => {
  try {
    await serialMonitor.connect(port, baudRate);
    uiState.currentBaudRate = baudRate;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('serial:disconnect', async () => {
  try {
    await serialMonitor.disconnect();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('serial:send', async (event, data) => {
  try {
    await serialMonitor.send(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('serial:list-ports', async () => {
  try {
    const ports = await serialMonitor.listPorts();
    return { success: true, data: ports };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// File Dialog IPC Handlers
ipcMain.handle('dialog:open-file', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Arduino Sketch',
      filters: [
        { name: 'Arduino Sketches', extensions: ['ino'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('dialog:open-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Folder (Sketchbook or Project)',
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    return { success: true, folderPath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// File Read/Write IPC Handlers (use fsp for promises to avoid conflict with top-level fs)
const fsp = require('fs').promises;

// Folder / File tree
ipcMain.handle('folder:list', async (event, dirPath) => {
  try {
    if (!dirPath || typeof dirPath !== 'string') {
      return { success: false, error: 'Folder path is required' };
    }
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    const list = entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDirectory: e.isDirectory()
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    return { success: true, entries: list };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Library IPC Handlers
ipcMain.handle('lib:search', async (event, query) => {
  try {
    const data = await arduinoService.libSearch(query);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('lib:install', async (event, libSpec) => {
  try {
    await arduinoService.libInstall(libSpec);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('lib:list', async () => {
  try {
    const data = await arduinoService.libList();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('lib:update-index', async () => {
  try {
    await arduinoService.libUpdateIndex();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('lib:uninstall', async (event, libName) => {
  try {
    await arduinoService.libUninstall(libName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const content = await fsp.readFile(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('file:save', async (event, filePath, content) => {
  try {
    await fsp.writeFile(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Error Memory IPC Handlers
ipcMain.handle('errors:get-history', async () => {
  try {
    const history = await errorMemory.getHistory();
    return { success: true, data: history };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('errors:add-fix', async (event, errorId, fix) => {
  try {
    await errorMemory.addFix(errorId, fix);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// AI Agent IPC Handlers
ipcMain.handle('ai:set-provider', async (event, providerName, apiKey, model) => {
  try {
    // If API key provided, save it first
    if (apiKey && apiKey.trim().length > 0) {
      try {
        apiKeyManager.setAPIKey(providerName, apiKey);
      } catch (keyError) {
        return { success: false, error: `Failed to save API key: ${keyError.message}` };
      }
    }
    
    // Get the API key (either from parameter or stored)
    const key = apiKey || apiKeyManager.getAPIKey(providerName);
    
    if (!key || key.trim().length === 0) {
      return { success: false, error: 'API key not found. Please provide an API key.' };
    }
    
    // Set the provider with model
    aiAgent.setProvider(providerName, key, model);
    return { success: true, provider: providerName, model: model || 'default' };
  } catch (error) {
    console.error('Error setting AI provider:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:process-query', async (event, query, context, mode) => {
  try {
    const enrichedContext = {
      ...context,
      currentBaudRate: uiState.currentBaudRate,
      currentSketchPath: uiState.currentSketchPath,
      selectedBoard: uiState.selectedBoard,
      selectedPort: uiState.selectedPort,
      hasFileOpen: context.hasFileOpen || false
    };
    const effectiveMode = mode === 'ask' || mode === 'debug' ? mode : 'agent';
    const result = await aiAgent.processQuery(query, enrichedContext, effectiveMode);
    return { success: true, data: result };
  } catch (error) {
    console.error('AI process query error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:analyze-error', async (event, errorMessage, context) => {
  try {
    const result = await aiAgent.analyzeError(errorMessage, context);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:analyze-serial', async (event, serialOutput, lines) => {
  try {
    const result = await aiAgent.analyzeSerialOutput(serialOutput, lines);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:get-providers', async () => {
  try {
    const providers = aiAgent.getAvailableProviders();
    return { success: true, data: providers };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:get-models', async (event, provider) => {
  try {
    const models = aiAgent.getAvailableModels(provider);
    return { success: true, data: models };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:get-unified-models', async () => {
  try {
    const list = aiAgent.getUnifiedModelList();
    return { success: true, data: list };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:set-model', async (event, modelId) => {
  try {
    const AIAgentClass = require('./services/ai/agent');
    const providerName = AIAgentClass.getProviderFromModel(modelId);
    if (!providerName) {
      return { success: false, error: 'Unknown model' };
    }
    const key = apiKeyManager.getAPIKey(providerName);
    if (!key || key.trim().length === 0) {
      return { success: false, error: 'API key required', needsKey: true, provider: providerName };
    }
    aiAgent.setProvider(providerName, key, modelId);
    return { success: true, provider: providerName, model: modelId };
  } catch (error) {
    console.error('AI set model error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai:get-memory-stats', async () => {
  try {
    const stats = aiAgent.memory.getStats();
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// AI Tool Execution Handler - for direct tool calls from UI
ipcMain.handle('ai:execute-tool', async (event, toolName, args) => {
  try {
    if (!aiAgent.toolExecutor) {
      return { success: false, error: 'Tool executor not initialized' };
    }
    
    const result = await aiAgent.toolExecutor.execute({
      name: toolName,
      arguments: args
    });
    
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// API Key Management IPC Handlers
ipcMain.handle('api-keys:set', async (event, provider, apiKey) => {
  try {
    apiKeyManager.setAPIKey(provider, apiKey);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-keys:get', async (event, provider) => {
  try {
    const config = apiKeyManager.getProviderConfig(provider);
    return { success: true, data: config };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-keys:has', async (event, provider) => {
  try {
    const hasKey = apiKeyManager.hasAPIKey(provider);
    return { success: true, hasKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('api-keys:remove', async (event, provider) => {
  try {
    apiKeyManager.removeAPIKey(provider);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
