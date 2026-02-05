const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Arduino CLI methods
  arduino: {
    compile: (sketchPath, boardFQBN) => ipcRenderer.invoke('arduino:compile', sketchPath, boardFQBN),
    upload: (sketchPath, boardFQBN, port) => ipcRenderer.invoke('arduino:upload', sketchPath, boardFQBN, port),
    listBoards: () => ipcRenderer.invoke('arduino:list-boards'),
    listPorts: () => ipcRenderer.invoke('arduino:list-ports'),
    checkCLI: () => ipcRenderer.invoke('arduino:check-cli')
  },
  
  // Serial Monitor methods
  serial: {
    connect: (port, baudRate) => ipcRenderer.invoke('serial:connect', port, baudRate),
    disconnect: () => ipcRenderer.invoke('serial:disconnect'),
    send: (data) => ipcRenderer.invoke('serial:send', data),
    listPorts: () => ipcRenderer.invoke('serial:list-ports'),
    onData: (callback) => ipcRenderer.on('serial:data', (event, data) => callback(data)),
    onError: (callback) => ipcRenderer.on('serial:error', (event, error) => callback(error)),
    onConnected: (callback) => ipcRenderer.on('serial:connected', () => callback()),
    onDisconnected: (callback) => ipcRenderer.on('serial:disconnected', () => callback())
  },
  
  // Error Memory methods
  errors: {
    getHistory: () => ipcRenderer.invoke('errors:get-history'),
    addFix: (errorId, fix) => ipcRenderer.invoke('errors:add-fix', errorId, fix)
  },
  
  // File Dialog methods
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:open-file'),
    openFolder: () => ipcRenderer.invoke('dialog:open-folder')
  },

  // Folder / file tree
  folder: {
    list: (dirPath) => ipcRenderer.invoke('folder:list', dirPath)
  },
  
  // File operations
  file: {
    read: (filePath) => ipcRenderer.invoke('file:read', filePath),
    save: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content)
  },

  // Library Manager (Arduino CLI lib)
  lib: {
    search: (query) => ipcRenderer.invoke('lib:search', query),
    install: (libSpec) => ipcRenderer.invoke('lib:install', libSpec),
    list: () => ipcRenderer.invoke('lib:list'),
    updateIndex: () => ipcRenderer.invoke('lib:update-index'),
    uninstall: (libName) => ipcRenderer.invoke('lib:uninstall', libName)
  },
  
  // AI Agent methods
  ai: {
    setProvider: (providerName, apiKey, model) => ipcRenderer.invoke('ai:set-provider', providerName, apiKey, model),
    processQuery: (query, context, mode) => ipcRenderer.invoke('ai:process-query', query, context, mode),
    setModel: (modelId) => ipcRenderer.invoke('ai:set-model', modelId),
    analyzeError: (errorMessage, context) => ipcRenderer.invoke('ai:analyze-error', errorMessage, context),
    analyzeSerial: (serialOutput, lines) => ipcRenderer.invoke('ai:analyze-serial', serialOutput, lines),
    getProviders: () => ipcRenderer.invoke('ai:get-providers'),
    getModels: (provider) => ipcRenderer.invoke('ai:get-models', provider),
    getUnifiedModels: () => ipcRenderer.invoke('ai:get-unified-models'),
    getMemoryStats: () => ipcRenderer.invoke('ai:get-memory-stats'),
    executeTool: (toolName, args) => ipcRenderer.invoke('ai:execute-tool', toolName, args)
  },
  
  // API Key Management methods
  apiKeys: {
    set: (provider, apiKey) => ipcRenderer.invoke('api-keys:set', provider, apiKey),
    get: (provider) => ipcRenderer.invoke('api-keys:get', provider),
    has: (provider) => ipcRenderer.invoke('api-keys:has', provider),
    remove: (provider) => ipcRenderer.invoke('api-keys:remove', provider)
  },
  
  app: {
    quit: () => ipcRenderer.send('app:quit')
  },
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  menu: {
    onAction: (callback) => ipcRenderer.on('menu:action', (event, action) => callback(action))
  },

  // UI State sync methods - for AI to access editor/UI state
  ui: {
    updateState: (key, value) => ipcRenderer.send('ui:update-state', key, value),
    updateEditorCode: (code) => ipcRenderer.send('ui:update-editor-code', code),
    updateSketchPath: (path) => ipcRenderer.send('ui:update-sketch-path', path),
    updateBaudRate: (baudRate) => ipcRenderer.send('ui:update-baud-rate', baudRate),
    updateBoard: (board) => ipcRenderer.send('ui:update-board', board),
    updatePort: (port) => ipcRenderer.send('ui:update-port', port),
    
    // Listen for UI update requests from main process (AI)
    onGetEditorCode: (callback) => {
      ipcRenderer.on('ui:get-editor-code', () => {
        const code = callback();
        ipcRenderer.invoke('ui:editor-code-response', code);
      });
    },
    onSetEditorCode: (callback) => ipcRenderer.on('ui:set-editor-code', (event, code) => callback(code)),
    onSetBaudRate: (callback) => ipcRenderer.on('ui:set-baud-rate', (event, baudRate) => callback(baudRate))
  }
});
