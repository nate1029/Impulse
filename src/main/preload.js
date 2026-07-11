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
    checkCLI: () => ipcRenderer.invoke('arduino:check-cli'),
    coreSearch: (keyword) => ipcRenderer.invoke('arduino:core-search', keyword),
    coreList: () => ipcRenderer.invoke('arduino:core-list'),
    coreInstall: (coreId) => ipcRenderer.invoke('arduino:core-install', coreId),
    coreUninstall: (coreId) => ipcRenderer.invoke('arduino:core-uninstall', coreId),
    libExamples: (libraryName) => ipcRenderer.invoke('arduino:lib-examples', libraryName),
    libExamplesWithPaths: (libraryFilter) => ipcRenderer.invoke('arduino:lib-examples-with-paths', libraryFilter)
  },
  
  // Serial Monitor methods
  serial: {
    connect: (port, baudRate) => ipcRenderer.invoke('serial:connect', port, baudRate),
    disconnect: () => ipcRenderer.invoke('serial:disconnect'),
    send: (data) => ipcRenderer.invoke('serial:send', data),
    listPorts: () => ipcRenderer.invoke('serial:list-ports'),
    onData: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('serial:data', handler);
      return () => ipcRenderer.removeListener('serial:data', handler);
    },
    onError: (callback) => {
      const handler = (event, error) => callback(error);
      ipcRenderer.on('serial:error', handler);
      return () => ipcRenderer.removeListener('serial:error', handler);
    },
    onConnected: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('serial:connected', handler);
      return () => ipcRenderer.removeListener('serial:connected', handler);
    },
    onDisconnected: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('serial:disconnected', handler);
      return () => ipcRenderer.removeListener('serial:disconnected', handler);
    },
    onReconnecting: (callback) => {
      const handler = (event, info) => callback(info);
      ipcRenderer.on('serial:reconnecting', handler);
      return () => ipcRenderer.removeListener('serial:reconnecting', handler);
    },
    onReconnected: (callback) => {
      const handler = (event, info) => callback(info);
      ipcRenderer.on('serial:reconnected', handler);
      return () => ipcRenderer.removeListener('serial:reconnected', handler);
    },
    onReconnectFailed: (callback) => {
      const handler = (event, info) => callback(info);
      ipcRenderer.on('serial:reconnect-failed', handler);
      return () => ipcRenderer.removeListener('serial:reconnect-failed', handler);
    }
  },
  
  // Error Memory methods
  errors: {
    getHistory: () => ipcRenderer.invoke('errors:get-history'),
    addFix: (errorId, fix) => ipcRenderer.invoke('errors:add-fix', errorId, fix)
  },
  
  // File Dialog methods
  dialog: {
    openFile: () => ipcRenderer.invoke('dialog:open-file'),
    openFolder: () => ipcRenderer.invoke('dialog:open-folder'),
    saveNewSketch: () => ipcRenderer.invoke('dialog:save-new-sketch'),
    saveAsSketch: (content) => ipcRenderer.invoke('dialog:save-as-sketch', content)
  },

  // Shell (e.g. show in folder)
  shell: {
    showItemInFolder: (fullPath) => ipcRenderer.invoke('shell:show-item-in-folder', fullPath)
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
    processQuery: (query, context, mode, attachments) => ipcRenderer.invoke('ai:process-query', query, context, mode, attachments),
    cancel: () => ipcRenderer.invoke('ai:cancel'),
    recordFeedback: (entry) => ipcRenderer.invoke('ai:record-feedback', entry),
    setModel: (modelId, manual) => ipcRenderer.invoke('ai:set-model', modelId, manual),
    getModelSuggestion: () => ipcRenderer.invoke('ai:get-model-suggestion'),
    pinModel: (modelId) => ipcRenderer.invoke('ai:pin-model', modelId),
    setAutoUpgrade: (enabled) => ipcRenderer.invoke('ai:set-auto-upgrade', enabled),
    analyzeError: (errorMessage, context) => ipcRenderer.invoke('ai:analyze-error', errorMessage, context),
    analyzeSerial: (serialOutput, lines) => ipcRenderer.invoke('ai:analyze-serial', serialOutput, lines),
    getProviders: () => ipcRenderer.invoke('ai:get-providers'),
    getModels: (provider) => ipcRenderer.invoke('ai:get-models', provider),
    getUnifiedModels: () => ipcRenderer.invoke('ai:get-unified-models'),
    summarizeHistory: () => ipcRenderer.invoke('ai:summarize-history'),
    clearHistory: () => ipcRenderer.invoke('ai:clear-history'),
    getMemoryStats: () => ipcRenderer.invoke('ai:get-memory-stats'),
    executeTool: (toolName, args) => ipcRenderer.invoke('ai:execute-tool', toolName, args),
    onToolEvent: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('ai:tool-event', handler);
      return () => ipcRenderer.removeListener('ai:tool-event', handler);
    },
    onTextChunk: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('ai:text-chunk', handler);
      return () => ipcRenderer.removeListener('ai:text-chunk', handler);
    },
    onPendingEdit: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('ai:pending-edit', handler);
      return () => ipcRenderer.removeListener('ai:pending-edit', handler);
    },
    decidePendingEdit: (id, accepted) => ipcRenderer.send('ai:pending-edit-decide', { id, accepted })
  },
  
  // API Key Management methods
  apiKeys: {
    set: (provider, apiKey) => ipcRenderer.invoke('api-keys:set', provider, apiKey),
    get: (provider) => ipcRenderer.invoke('api-keys:get', provider),
    has: (provider) => ipcRenderer.invoke('api-keys:has', provider),
    remove: (provider) => ipcRenderer.invoke('api-keys:remove', provider),
    list: () => ipcRenderer.invoke('api-keys:list')
  },
  
  // Terminal integration
  terminal: {
    isAvailable: () => ipcRenderer.invoke('terminal:available'),
    create: (options) => ipcRenderer.invoke('terminal:create', options),
    write: (id, data) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id) => ipcRenderer.invoke('terminal:kill', id),
    list: () => ipcRenderer.invoke('terminal:list'),
    onData: (callback) => {
      const handler = (event, id, data) => callback(id, data);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
    onExit: (callback) => {
      const handler = (event, id, exitCode) => callback(id, exitCode);
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    }
  },

  // Auto-updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback) => {
      const channels = [
        'updater:checking', 'updater:available', 'updater:not-available',
        'updater:progress', 'updater:downloaded', 'updater:error'
      ];
      const handlers = channels.map(ch => {
        const handler = (event, data) => callback(ch.replace('updater:', ''), data);
        ipcRenderer.on(ch, handler);
        return { ch, handler };
      });
      return () => handlers.forEach(({ ch, handler }) => ipcRenderer.removeListener(ch, handler));
    }
  },

  // Collaboration
  collab: {
    createRoom: (content, userName) => ipcRenderer.invoke('collab:create-room', content, userName),
    joinRoom: (roomId, userName) => ipcRenderer.invoke('collab:join-room', roomId, userName),
    leaveRoom: () => ipcRenderer.invoke('collab:leave-room'),
    applyChange: (index, deleteCount, insertText) => ipcRenderer.invoke('collab:apply-change', index, deleteCount, insertText),
    getText: () => ipcRenderer.invoke('collab:get-text'),
    getPeers: () => ipcRenderer.invoke('collab:get-peers'),
    getStatus: () => ipcRenderer.invoke('collab:get-status'),
    updateCursor: (pos, selStart, selEnd) => ipcRenderer.invoke('collab:update-cursor', pos, selStart, selEnd),
    observe: () => ipcRenderer.invoke('collab:observe'),
    onRemoteChange: (callback) => {
      const handler = (event, change) => callback(change);
      ipcRenderer.on('collab:remote-change', handler);
      return () => ipcRenderer.removeListener('collab:remote-change', handler);
    },
    onPeerJoined: (callback) => {
      const handler = (event, info) => callback(info);
      ipcRenderer.on('collab:peer-joined', handler);
      return () => ipcRenderer.removeListener('collab:peer-joined', handler);
    },
    onPeerLeft: (callback) => {
      const handler = (event, info) => callback(info);
      ipcRenderer.on('collab:peer-left', handler);
      return () => ipcRenderer.removeListener('collab:peer-left', handler);
    },
    onAwareness: (callback) => {
      const handler = (event, info) => callback(info);
      ipcRenderer.on('collab:awareness', handler);
      return () => ipcRenderer.removeListener('collab:awareness', handler);
    }
  },

  // Plugin system
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    commands: () => ipcRenderer.invoke('plugins:commands'),
    executeCommand: (cmdId, ...args) => ipcRenderer.invoke('plugins:execute-command', cmdId, ...args),
    boards: () => ipcRenderer.invoke('plugins:boards')
  },

  workspace: {
    setRoot: (root) => ipcRenderer.invoke('workspace:set-root', root),
    listFiles: () => ipcRenderer.invoke('workspace:list-files'),
    readRules: () => ipcRenderer.invoke('workspace:read-rules'),
    writeRules: (content) => ipcRenderer.invoke('workspace:write-rules', content),
    onFileWritten: (cb) => ipcRenderer.on('workspace:file-written', (_e, data) => cb(data))
  },

  // Chat session history
  chats: {
    list: () => ipcRenderer.invoke('chat:list'),
    get: (id) => ipcRenderer.invoke('chat:get', id),
    create: (title, model) => ipcRenderer.invoke('chat:create', title, model),
    append: (id, message) => ipcRenderer.invoke('chat:append', id, message),
    rename: (id, title) => ipcRenderer.invoke('chat:rename', id, title),
    remove: (id) => ipcRenderer.invoke('chat:delete', id)
  },

  // Google auth gate
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    signIn: () => ipcRenderer.invoke('auth:sign-in'),
    signOut: () => ipcRenderer.invoke('auth:sign-out')
  },

  app: {
    quit: () => ipcRenderer.send('app:quit')
  },

  // Custom titlebar window controls
  win: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
    close: () => ipcRenderer.send('window:close'),
    onMaximizedChange: (callback) => {
      const handler = (event, maximized) => callback(maximized);
      ipcRenderer.on('window:maximized-change', handler);
      return () => ipcRenderer.removeListener('window:maximized-change', handler);
    }
  },
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  menu: {
    onAction: (callback) => {
      const handler = (event, action) => callback(action);
      ipcRenderer.on('menu:action', handler);
      return () => ipcRenderer.removeListener('menu:action', handler);
    }
  },

  // UI State sync methods - for AI to access editor/UI state
  ui: {
    updateState: (key, value) => ipcRenderer.send('ui:update-state', key, value),
    updateEditorCode: (code) => ipcRenderer.send('ui:update-editor-code', code),
    updateSketchPath: (path) => ipcRenderer.send('ui:update-sketch-path', path),
    updateBaudRate: (baudRate) => ipcRenderer.send('ui:update-baud-rate', baudRate),
    updateBoard: (board) => ipcRenderer.send('ui:update-board', board),
    updatePort: (port) => ipcRenderer.send('ui:update-port', port),
    updateCompileResult: (result) => ipcRenderer.send('ui:update-compile-result', result),
    
    // Listen for UI update requests from main process (AI)
    onGetEditorCode: (callback) => {
      const handler = () => {
        const code = callback();
        ipcRenderer.send('ui:editor-code-response', code);
      };
      ipcRenderer.on('ui:get-editor-code', handler);
      return () => ipcRenderer.removeListener('ui:get-editor-code', handler);
    },
    onSetEditorCode: (callback) => {
      const handler = (event, code) => callback(code);
      ipcRenderer.on('ui:set-editor-code', handler);
      return () => ipcRenderer.removeListener('ui:set-editor-code', handler);
    },
    onSetBaudRate: (callback) => {
      const handler = (event, baudRate) => callback(baudRate);
      ipcRenderer.on('ui:set-baud-rate', handler);
      return () => ipcRenderer.removeListener('ui:set-baud-rate', handler);
    },
    onPlaygroundUpdate: (callback) => {
      const handler = (event, content, append) => callback(content, append);
      ipcRenderer.on('playground:update', handler);
      return () => ipcRenderer.removeListener('playground:update', handler);
    }
  },

  // Notification system
  onNotification: (channel, callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
