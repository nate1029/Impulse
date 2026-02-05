// ============================================
// Impulse IDE - Renderer
// Modern UI with Activity Bar & Panels
// ============================================

// UI State
let state = {
    cliInstalled: false,
    boards: [],
    ports: [],
    serialPorts: [],
    serialConnected: false,
    currentSketch: null,
    currentFile: null,
    editor: null,
    // Multi-file tabs: [{ path, content, name }]
    openFiles: [],
    activeTabIndex: -1,
    aiPanelOpen: false,
    aiPanelCollapsed: false,
    aiPanelWidth: 380,
    aiProviderConfigured: false,
    aiMode: 'agent',
    aiModelId: null,
    aiUnifiedModels: [],
    apiKeyModalProvider: null,
    folderRoot: null,
    expandedDirs: new Set(),
    installedLibs: new Map(),
    libSearchResults: [],
    activePanel: 'explorer',
    sidebarCollapsed: false,
    darkMode: false,
    // Context awareness state
    context: {
        activeFile: null,
        selectedBoard: null,
        selectedPort: null,
        lastCompileResult: null,
        currentBaudRate: 115200,
        serialConnected: false
    }
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    initializeCodeMirror();
    await checkArduinoCLI();
    await loadBoards();
    await loadPorts();
    await loadAIUnifiedModels();
    restoreAIPreferences();
    await restoreSession();
    
    setupNativeMenuListener();
    setupActivityBar();
    setupSidebarCollapse();
    setupEventListeners();
    setupSerialListeners();
    setupAIListeners();
    setupUIStateSync();
    setupOutputTabs();
    setupKeyboardShortcuts();
    setupFooterThemeToggle();
    syncDropdowns();
    setupAIPanelOverlay();
    setupContextAwareness();
    setupSerialButtons();
    setupAutoSave();
    
    logToConsole('Impulse IDE initialized', 'info');
});

// ============================================
// Activity Bar & Panel Switching
// ============================================
function setupActivityBar() {
    const activityIcons = document.querySelectorAll('.activity-icon[data-panel]');
    
    activityIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const panelId = icon.dataset.panel;
            
            // If clicking the same panel, toggle sidebar
            if (state.activePanel === panelId && !state.sidebarCollapsed) {
                toggleSidebar();
                return;
            }
            
            // Expand sidebar if collapsed
            if (state.sidebarCollapsed) {
                toggleSidebar();
            }
            
            // Switch to the panel
            switchPanel(panelId);
        });
        
        // Double click to collapse sidebar
        icon.addEventListener('dblclick', () => {
            if (!state.sidebarCollapsed) {
                toggleSidebar();
            }
        });
    });
    
    // AI toggle is now in top toolbar (aiAgentTab)
}

function switchPanel(panelId) {
    state.activePanel = panelId;
    
    // Update activity icons
    document.querySelectorAll('.activity-icon[data-panel]').forEach(icon => {
        icon.classList.toggle('active', icon.dataset.panel === panelId);
    });
    
    // Update sidebar panels
    document.querySelectorAll('.sidebar-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetPanel = document.getElementById(`${panelId}Panel`);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }
    
    // Load data for specific panels
    if (panelId === 'libraries') {
        loadInstalledLibs();
    }

    // If user opens Serial panel, also show Serial output tab
    if (panelId === 'serial') {
        document.querySelector('.output-tab[data-tab="serial"]')?.click();
    }
}

function setupSidebarCollapse() {
    const collapseButtons = document.querySelectorAll('.sidebar-collapse-btn');
    collapseButtons.forEach(btn => {
        btn.addEventListener('click', toggleSidebar);
    });
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    state.sidebarCollapsed = !state.sidebarCollapsed;
    
    if (sidebar) {
        sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
    }
}

// ============================================
// Keyboard Shortcuts
// ============================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+E: Explorer
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('explorer');
        }
        // Ctrl+Shift+B: Boards
        if (e.ctrlKey && e.shiftKey && e.key === 'B') {
            e.preventDefault();
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('boards');
        }
        // Ctrl+Shift+L: Libraries
        if (e.ctrlKey && e.shiftKey && e.key === 'L') {
            e.preventDefault();
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('libraries');
        }
        // Ctrl+Shift+M: Serial Monitor
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            e.preventDefault();
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('serial');
        }
        // Ctrl+Shift+A: AI Panel
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            toggleAIPanel();
        }
        // Ctrl+Shift+M: Serial Monitor (also opens serial panel)
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            e.preventDefault();
            document.getElementById('serialMonitorBtn')?.click();
        }
        // Ctrl+R: Verify/Compile
        if (e.ctrlKey && !e.shiftKey && e.key === 'r') {
            e.preventDefault();
            compileSketch();
        }
        // Ctrl+U: Upload
        if (e.ctrlKey && !e.shiftKey && e.key === 'u') {
            e.preventDefault();
            uploadSketch();
        }
    });
}

// ============================================
// Native application menu (File, Edit, Sketch, Tools, Help)
// ============================================
function setupNativeMenuListener() {
    if (window.electronAPI?.menu?.onAction) {
        window.electronAPI.menu.onAction((action) => {
            handleMenuAction(action);
        });
    }
}

function handleMenuAction(action) {
    switch (action) {
        // File
        case 'file-new':
            newSketch();
            break;
        case 'file-open':
            openFile();
            break;
        case 'file-open-recent':
            logToConsole('Open Recent: not implemented', 'info');
            break;
        case 'file-open-folder':
            openFolder();
            break;
        case 'file-save':
            saveFile();
            break;
        case 'file-save-as':
            saveFileAs();
            break;
        case 'file-preferences':
            showPreferences();
            break;
        case 'file-close':
            closeCurrentTab();
            break;
        case 'file-quit':
            if (typeof window.electronAPI !== 'undefined' && window.electronAPI.app?.quit) {
                window.electronAPI.app.quit();
            } else {
                logToConsole('Quit: use window close or Alt+F4', 'info');
            }
            break;
        // Edit
        case 'edit-undo':
            if (state.editor) state.editor.undo();
            break;
        case 'edit-redo':
            if (state.editor) state.editor.redo();
            break;
        case 'edit-cut':
            if (state.editor) document.execCommand('cut');
            break;
        case 'edit-copy':
            if (state.editor) document.execCommand('copy');
            break;
        case 'edit-paste':
            if (state.editor) document.execCommand('paste');
            break;
        case 'edit-select-all':
            if (state.editor) state.editor.execCommand('selectAll');
            break;
        case 'edit-goto-line':
            gotoLine();
            break;
        case 'edit-comment':
            if (state.editor) toggleComment();
            break;
        case 'edit-increase-indent':
            if (state.editor) state.editor.indentSelection('add');
            break;
        case 'edit-decrease-indent':
            if (state.editor) state.editor.indentSelection('subtract');
            break;
        case 'edit-format':
            if (state.editor) autoFormat();
            break;
        case 'edit-find':
            if (state.editor) findInEditor();
            break;
        case 'edit-find-next':
            if (state.editor) findNext();
            break;
        case 'edit-find-prev':
            if (state.editor) findPrev();
            break;
        case 'edit-font-increase':
            increaseEditorFontSize();
            break;
        case 'edit-font-decrease':
            decreaseEditorFontSize();
            break;
        // Sketch
        case 'sketch-verify':
            compileSketch();
            break;
        case 'sketch-upload':
            uploadSketch();
            break;
        case 'sketch-upload-programmer':
            logToConsole('Upload Using Programmer: not implemented', 'info');
            break;
        case 'sketch-export-binary':
            exportCompiledBinary();
            break;
        case 'sketch-show-folder':
            showSketchFolder();
            break;
        case 'sketch-include-library':
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('libraries');
            break;
        case 'sketch-add-file':
            addFileToSketch();
            break;
        // Tools
        case 'tools-format':
            if (state.editor) autoFormat();
            break;
        case 'tools-archive':
            archiveSketch();
            break;
        case 'tools-manage-libs':
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('libraries');
            break;
        case 'tools-serial-monitor':
            document.querySelector('.output-tab[data-tab="serial"]')?.click();
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('serial');
            break;
        case 'tools-serial-plotter':
            logToConsole('Serial Plotter: coming soon', 'info');
            break;
        case 'tools-board':
            document.getElementById('boardPortDropdown')?.click();
            break;
        case 'tools-port':
            document.getElementById('boardPortDropdown')?.click();
            break;
        case 'tools-reload-boards':
            loadBoards();
            loadPorts();
            break;
        case 'tools-get-board-info':
            getBoardInfo();
            break;
        // Help
        case 'help-getting-started':
        case 'help-environment':
        case 'help-troubleshooting':
        case 'help-reference':
        case 'help-find-reference':
        case 'help-faq':
            logToConsole(`Help: ${action.replace('help-', '')} — open https://docs.arduino.cc`, 'info');
            break;
        case 'help-visit-arduino':
            if (typeof window.electronAPI !== 'undefined' && window.electronAPI.openExternal) {
                window.electronAPI.openExternal('https://www.arduino.cc').catch(() => {});
            }
            break;
        case 'help-about':
            showAbout();
            break;
        default:
            break;
    }
}

function newSketch() {
    showWelcomeState();
    state.folderRoot = null;
    const label = document.getElementById('folderLabel');
    if (label) label.innerHTML = '<span class="folder-icon">📁</span><span>No folder open</span>';
    document.getElementById('fileTree').innerHTML = '';
    logToConsole('New sketch — open a folder to start', 'info');
}

async function openFile() {
    try {
        const result = await window.electronAPI.dialog.openFile();
        if (result.success && result.filePath) {
            const fileResult = await window.electronAPI.file.read(result.filePath);
            if (fileResult.success) {
                const name = result.filePath.split(/[/\\]/).pop();
                const ext = (name.split('.').pop() || '').toLowerCase();
                if (['ino', 'h', 'hpp', 'cpp', 'c', 'txt', 'json'].includes(ext) && state.editor) {
                    showEditor();
                    addOrFocusFile(result.filePath, fileResult.content, name);
                    switchToTab(state.openFiles.length - 1);
                    logToConsole(`Opened: ${name}`, 'success');
                } else {
                    logToConsole('Unsupported file type for editing', 'warning');
                }
            }
        }
    } catch (e) {
        logToConsole(`Open file error: ${e.message}`, 'error');
    }
}

// Auto-save current file every 30 seconds
function setupAutoSave() {
    setInterval(() => {
        if (!state.currentFile || !state.editor) return;
        const code = state.editor.getValue();
        const file = state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex] ? state.openFiles[state.activeTabIndex] : null;
        if (!file) return;
        if (file.content === code) return; // no changes
        saveFile();
    }, 30000);
}

function saveFile() {
    if (!state.currentFile) {
        logToConsole('No file open to save', 'warning');
        return;
    }
    if (state.editor && state.currentSketch) {
        const code = state.editor.getValue();
        window.electronAPI.file.save(state.currentSketch, code).then(() => {
            if (state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex]) {
                state.openFiles[state.activeTabIndex].content = code;
            }
            logToConsole('Saved', 'success');
        }).catch(e => logToConsole(`Save error: ${e.message}`, 'error'));
    } else if (state.editor && state.currentFile) {
        const code = state.editor.getValue();
        window.electronAPI.file.save(state.currentFile, code).then(() => {
            if (state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex]) {
                state.openFiles[state.activeTabIndex].content = code;
            }
            logToConsole('Saved', 'success');
        }).catch(e => logToConsole(`Save error: ${e.message}`, 'error'));
    }
}

function saveFileAs() {
    if (!state.currentFile) {
        logToConsole('No file open', 'warning');
        return;
    }
    logToConsole('Save As: use File > Open Folder and save in that folder', 'info');
}

function showPreferences() {
    logToConsole('Preferences: coming soon', 'info');
}

function closeCurrentTab() {
    if (state.activeTabIndex >= 0) closeTab(state.activeTabIndex);
    else logToConsole('No tab to close', 'info');
}

function gotoLine() {
    const line = prompt('Go to line number:');
    if (line != null && state.editor) {
        const n = parseInt(line, 10);
        if (!isNaN(n) && n >= 1) state.editor.setCursor(n - 1, 0);
    }
}

function toggleComment() {
    if (!state.editor) return;
    const range = { from: state.editor.getCursor('from'), to: state.editor.getCursor('to') };
    const lineFrom = range.from.line;
    const lineTo = range.to.line;
    const lineText = state.editor.getLine(lineFrom);
    const isComment = /^\s*\/\//.test(lineText);
    state.editor.operation(() => {
        for (let i = lineFrom; i <= lineTo; i++) {
            const text = state.editor.getLine(i);
            if (isComment) {
                const newText = text.replace(/^\s*\/\/\s?/, '');
                state.editor.replaceRange(newText, { line: i, ch: 0 }, { line: i, ch: text.length });
            } else {
                state.editor.replaceRange('// ' + text, { line: i, ch: 0 }, { line: i, ch: 0 });
            }
        }
    });
}

function autoFormat() {
    if (!state.editor) return;
    const lineCount = state.editor.lineCount();
    state.editor.setSelection({ line: 0, ch: 0 }, { line: lineCount - 1, ch: state.editor.getLine(lineCount - 1).length });
    if (typeof state.editor.autoFormatRange === 'function') {
        state.editor.autoFormatRange({ line: 0, ch: 0 }, { line: lineCount - 1, ch: state.editor.getLine(lineCount - 1).length });
    } else {
        state.editor.indentSelection('add');
    }
}

function findInEditor() {
    if (!state.editor) return;
    const q = prompt('Find:');
    if (q != null && q.length) state.editor.execCommand('find');
}

function findNext() {
    if (state.editor) state.editor.execCommand('findNext');
}

function findPrev() {
    if (state.editor) state.editor.execCommand('findPrev');
}

let editorFontSize = 14;
function increaseEditorFontSize() {
    editorFontSize = Math.min(24, (editorFontSize || 14) + 1);
    document.querySelector('.CodeMirror')?.style.setProperty('font-size', `${editorFontSize}px`);
}

function decreaseEditorFontSize() {
    editorFontSize = Math.max(10, (editorFontSize || 14) - 1);
    document.querySelector('.CodeMirror')?.style.setProperty('font-size', `${editorFontSize}px`);
}

async function exportCompiledBinary() {
    if (!state.currentSketch) {
        logToConsole('Open a sketch first', 'warning');
        return;
    }
    logToConsole('Export Compiled Binary: coming soon', 'info');
}

function showSketchFolder() {
    if (state.folderRoot) {
        if (window.electronAPI?.shell?.showItemInFolder) {
            window.electronAPI.shell.showItemInFolder(state.folderRoot);
        } else {
            logToConsole(`Sketch folder: ${state.folderRoot}`, 'info');
        }
    } else {
        logToConsole('Open a folder first', 'warning');
    }
}

function addFileToSketch() {
    logToConsole('Add File: open a sketch folder and add files there', 'info');
}

function archiveSketch() {
    if (!state.currentSketch) {
        logToConsole('Open a sketch first', 'warning');
        return;
    }
    logToConsole('Archive Sketch: coming soon', 'info');
}

function getBoardInfo() {
    const port = document.getElementById('portSelectSidebar')?.value;
    if (!port) {
        logToConsole('Select a port first', 'warning');
        return;
    }
    logToConsole('Get Board Info: run from Tools or select port', 'info');
}

function showAbout() {
    logToConsole('Impulse IDE — hybrid Arduino IDE with AI assistant', 'info');
}

// ============================================
// Footer & theme toggle (dark/light)
// ============================================
function setupFooterThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    // Restore saved theme (icons toggled via CSS [data-theme])
    const saved = localStorage.getItem('arduino-ide-theme');
    if (saved === 'dark') {
        state.darkMode = true;
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        state.darkMode = false;
        document.documentElement.setAttribute('data-theme', 'light');
    }

    btn.addEventListener('click', () => {
        state.darkMode = !state.darkMode;
        document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
        localStorage.setItem('arduino-ide-theme', state.darkMode ? 'dark' : 'light');
    });
}

// ============================================
// Dropdown Synchronization
// ============================================
function syncDropdowns() {
    // Board/Port selectors are now only in sidebar
    const boardSelectSidebar = document.getElementById('boardSelectSidebar');
    const portSelectSidebar = document.getElementById('portSelectSidebar');
    
    if (boardSelectSidebar) {
        boardSelectSidebar.addEventListener('change', (e) => {
            state.selectedBoard = e.target.value;
            state.context.selectedBoard = e.target.value;
            window.electronAPI.ui.updateBoard(e.target.value);
            updateAIContext();
            saveSession();
        });
    }
    
    if (portSelectSidebar) {
        portSelectSidebar.addEventListener('change', (e) => {
            state.selectedPort = e.target.value;
            state.context.selectedPort = e.target.value;
            window.electronAPI.ui.updatePort(e.target.value);
            updateAIContext();
            saveSession();
        });
    }
}

// ============================================
// CodeMirror Editor
// ============================================
function initializeCodeMirror() {
    const textarea = document.getElementById('codeEditor');
    if (!textarea) return;
    
    state.editor = CodeMirror.fromTextArea(textarea, {
        mode: 'text/x-csrc',
        theme: 'default',
        lineNumbers: true,
        indentUnit: 2,
        tabSize: 2,
        indentWithTabs: false,
        autoCloseBrackets: true,
        matchBrackets: true,
        lineWrapping: true,
        styleActiveLine: true
    });
    
    state.editor.on('change', () => {
        const code = state.editor.getValue();
        window.electronAPI.ui.updateEditorCode(code);
    });
    
    // Initially show welcome state, hide editor
    showWelcomeState();
}

// Show/hide welcome state vs editor
function showWelcomeState() {
    const welcomeState = document.getElementById('welcomeState');
    const editorWrapper = document.getElementById('editorWrapper');
    
    if (welcomeState) welcomeState.style.display = 'flex';
    if (editorWrapper) editorWrapper.style.display = 'none';
    
    state.openFiles = [];
    state.activeTabIndex = -1;
    state.currentFile = null;
    state.currentSketch = null;
    renderFileTabs();
}

function showEditor() {
    const welcomeState = document.getElementById('welcomeState');
    const editorWrapper = document.getElementById('editorWrapper');
    
    if (welcomeState) welcomeState.style.display = 'none';
    if (editorWrapper) editorWrapper.style.display = 'block';
    
    // Refresh CodeMirror to fix any display issues
    if (state.editor) {
        setTimeout(() => state.editor.refresh(), 10);
    }
}

// ============================================
// Event Listeners Setup
// ============================================
function setupEventListeners() {
    // Open folder (sidebar only; welcome area is plain, no button)
    document.getElementById('openFolder')?.addEventListener('click', openFolder);
    
    // Refresh ports (sidebar only, toolbar removed)
    document.getElementById('refreshPortsSidebar')?.addEventListener('click', loadPorts);
    
    // Compile, Upload, and Build/Debug
    document.getElementById('compileBtn')?.addEventListener('click', compileSketch);
    document.getElementById('uploadBtn')?.addEventListener('click', uploadSketch);
    document.getElementById('buildDebugBtn')?.addEventListener('click', () => {
        // TODO: Implement Build/Debug functionality
        logToConsole('Build/Debug coming soon', 'info');
    });
    
    // Board/Port Selector
    setupBoardPortSelector();
    
    // Serial monitor
    document.getElementById('toggleSerial')?.addEventListener('click', toggleSerial);
    document.getElementById('sendSerial')?.addEventListener('click', sendSerialData);
    document.getElementById('serialInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendSerialData();
    });
    
    // Baud rate - allow changing while connected (will reconnect)
    document.getElementById('baudRate')?.addEventListener('change', async (e) => {
        const baudRate = parseInt(e.target.value);
        state.context.currentBaudRate = baudRate;
        window.electronAPI.ui.updateBaudRate(baudRate);
        updateAIContext();
        
        // If serial is connected, reconnect with new baud rate
        if (state.serialConnected) {
            const port = document.getElementById('portSelectSidebar')?.value;
            if (port) {
                logToConsole(`Changing baud rate to ${baudRate}...`, 'info');
                await window.electronAPI.serial.disconnect();
                // Small delay to ensure port is released
                await new Promise(resolve => setTimeout(resolve, 200));
                await window.electronAPI.serial.connect(port, baudRate);
            }
        }
    });
    
    // Library Manager
    document.getElementById('libSearchBtn')?.addEventListener('click', () => libSearch());
    document.getElementById('libSearchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') libSearch();
    });
    document.getElementById('libUpdateIndex')?.addEventListener('click', libUpdateIndex);
}

// ============================================
// Serial Monitor Listeners
// ============================================
function setupSerialListeners() {
    window.electronAPI.serial.onData((data) => {
        appendSerialOutput(data.data, data.timestamp);
    });

    window.electronAPI.serial.onError((error) => {
        appendSerialOutput(`Error: ${error}`, new Date().toISOString(), 'error');
        logToConsole(`Serial Error: ${error}`, 'error');
    });

    window.electronAPI.serial.onConnected(() => {
        state.serialConnected = true;
        state.context.serialConnected = true;
        updateSerialUI(true);
        updateAIContext();
        appendSerialOutput('Connected to serial port', new Date().toISOString(), 'info');
        logToConsole('Serial port connected', 'success');
    });

    window.electronAPI.serial.onDisconnected(() => {
        state.serialConnected = false;
        state.context.serialConnected = false;
        updateSerialUI(false);
        updateAIContext();
        appendSerialOutput('Disconnected from serial port', new Date().toISOString(), 'info');
        logToConsole('Serial port disconnected', 'info');
    });
}

// ============================================
// AI Panel Listeners
// ============================================
function setupAIListeners() {
    document.getElementById('aiModeSelect')?.addEventListener('change', (e) => {
        state.aiMode = e.target.value;
        saveAIPreferences();
    });
    document.getElementById('aiModelSelect')?.addEventListener('change', onAIModelChange);
    document.getElementById('aiSettingsBtn')?.addEventListener('click', openAPIKeyModalForCurrentProvider);
    document.getElementById('aiSend')?.addEventListener('click', sendAIMessage);
    document.getElementById('aiInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
        }
    });
    document.getElementById('apiKeyCancel')?.addEventListener('click', closeAPIKeyModal);
    document.getElementById('apiKeySave')?.addEventListener('click', saveAPIKeyFromModal);
    document.getElementById('apiKeyInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveAPIKeyFromModal();
    });
}

// ============================================
// UI State Sync
// ============================================
function setupUIStateSync() {
    window.electronAPI.ui.onGetEditorCode(() => {
        return state.editor ? state.editor.getValue() : '';
    });
    
    window.electronAPI.ui.onSetEditorCode((code) => {
        if (state.editor) {
            state.editor.setValue(code);
        }
    });
    
    window.electronAPI.ui.onSetBaudRate((baudRate) => {
        const baudSelect = document.getElementById('baudRate');
        if (baudSelect) {
            baudSelect.value = baudRate.toString();
        }
    });
}

// ============================================
// Output Tabs
// ============================================
function setupOutputTabs() {
    const tabs = document.querySelectorAll('.output-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.output-content').forEach(c => c.classList.remove('active'));
            const content = document.getElementById(`${tabName}Output`);
            if (content) content.classList.add('active');
            
            const serialInputRow = document.getElementById('serialInputRow');
            if (serialInputRow) {
                serialInputRow.style.display = tabName === 'serial' ? 'flex' : 'none';
            }
        });
    });
}

// ============================================
// Arduino CLI Functions
// ============================================
async function checkArduinoCLI() {
    const statusEl = document.getElementById('cliStatus');
    if (statusEl) statusEl.textContent = 'Checking CLI...';

    try {
        const result = await window.electronAPI.arduino.checkCLI();
        if (result.success && result.installed) {
            state.cliInstalled = true;
            if (statusEl) {
                statusEl.innerHTML = '<span style="color: var(--accent-green);">●</span> Arduino CLI Ready';
                statusEl.className = 'cli-status success';
            }
            logToConsole('Arduino CLI detected and ready', 'success');
        } else {
            state.cliInstalled = false;
            if (statusEl) {
                statusEl.innerHTML = '<span style="color: var(--accent-red);">●</span> CLI Not Found';
                statusEl.className = 'cli-status error';
            }
            logToConsole('Arduino CLI not found. Please install arduino-cli', 'error');
        }
    } catch (error) {
        state.cliInstalled = false;
        if (statusEl) {
            statusEl.innerHTML = '<span style="color: var(--accent-red);">●</span> CLI Error';
            statusEl.className = 'cli-status error';
        }
        logToConsole(`CLI check error: ${error.message}`, 'error');
    }
}

async function loadBoards() {
    // Only load into sidebar (board/port removed from top toolbar)
    const selects = [
        document.getElementById('boardSelectSidebar')
    ].filter(Boolean);
    
    selects.forEach(select => {
        select.innerHTML = '<option value="">Loading boards...</option>';
    });

    try {
        const result = await window.electronAPI.arduino.listBoards();
        if (result.success && result.data) {
            state.boards = result.data;
            const options = '<option value="">Select Board...</option>' + 
                result.data.map(board => 
                    `<option value="${board.fqbn}">${board.name}</option>`
                ).join('');
            
            selects.forEach(select => {
                select.innerHTML = options;
            });
            logToConsole(`Loaded ${result.data.length} boards`, 'info');
            
            // Update board/port display if selection exists
            if (state.selectedBoard) {
                const selectedBoard = result.data.find(b => b.fqbn === state.selectedBoard);
                if (selectedBoard) {
                    updateBoardPortDisplay(selectedBoard.name, state.selectedPort);
                }
            }
        } else {
            selects.forEach(select => {
                select.innerHTML = '<option value="">Error loading boards</option>';
            });
            logToConsole(`Failed to load boards: ${result.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        selects.forEach(select => {
            select.innerHTML = '<option value="">Error loading boards</option>';
        });
        logToConsole(`Error loading boards: ${error.message}`, 'error');
    }
}

async function loadPorts() {
    // Only load into sidebar (board/port removed from top toolbar)
    const selects = [
        document.getElementById('portSelectSidebar')
    ].filter(Boolean);
    
    selects.forEach(select => {
        select.innerHTML = '<option value="">Scanning ports...</option>';
    });

    try {
        const result = await window.electronAPI.arduino.listPorts();
        if (result.success && result.data) {
            state.ports = result.data;
            
            let options;
            if (result.data.length === 0) {
                options = '<option value="">No ports found</option>';
                logToConsole('No serial ports detected', 'warning');
            } else {
                options = '<option value="">Select Port...</option>' +
                    result.data.map(port => 
                        `<option value="${port.port}">${port.port} - ${port.board || 'Unknown'}</option>`
                    ).join('');
                logToConsole(`Found ${result.data.length} port(s)`, 'info');
            }
            
            selects.forEach(select => {
                select.innerHTML = options;
            });
            
            // Update board/port display if selection exists
            if (state.selectedBoard && state.selectedPort) {
                const selectedBoard = state.boards.find(b => b.fqbn === state.selectedBoard);
                if (selectedBoard) {
                    updateBoardPortDisplay(selectedBoard.name, state.selectedPort);
                }
            }
        } else {
            selects.forEach(select => {
                select.innerHTML = '<option value="">Error loading ports</option>';
            });
            logToConsole(`Failed to load ports: ${result.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        selects.forEach(select => {
            select.innerHTML = '<option value="">Error loading ports</option>';
        });
        logToConsole(`Error loading ports: ${error.message}`, 'error');
    }
}

// ============================================
// File Explorer Functions
// ============================================
async function openFolder() {
    try {
        const result = await window.electronAPI.dialog.openFolder();
        if (result.success && result.folderPath) {
            state.folderRoot = result.folderPath;
            state.expandedDirs.clear();
            
            const label = document.getElementById('folderLabel');
            const name = result.folderPath.split(/[/\\]/).pop() || result.folderPath;
            if (label) {
                label.innerHTML = `<span class="folder-icon">📁</span><span>${name}</span>`;
            }
            
            await renderFileTree(result.folderPath);
            saveSession();
            logToConsole(`Opened folder: ${name}`, 'success');
        }
    } catch (error) {
        logToConsole(`Error opening folder: ${error.message}`, 'error');
    }
}

async function renderFileTree(dirPath) {
    const container = document.getElementById('fileTree');
    if (!container) return;
    
    const res = await window.electronAPI.folder.list(dirPath);
    if (!res.success) {
        container.innerHTML = `<div class="lib-msg">${res.error || 'Failed to list'}</div>`;
        return;
    }
    
    container.innerHTML = '';
    
    for (const e of (res.entries || [])) {
        const row = document.createElement('div');
        row.className = 'tree-item' + (e.isDirectory ? ' tree-dir' : ' tree-file');
        row.dataset.path = e.path;
        row.dataset.isDir = e.isDirectory;
        
        const icon = e.isDirectory ? '📁' : (e.name.endsWith('.ino') ? '📄' : '📃');
        const chev = e.isDirectory ? '<span class="tree-chevron">▶</span>' : '<span class="tree-spacer"></span>';
        row.innerHTML = `${chev}<span class="tree-icon">${icon}</span><span class="tree-name">${e.name}</span>`;
        
        if (e.isDirectory) {
            row.addEventListener('click', () => toggleTreeDir(e.path, row));
        } else {
            row.addEventListener('click', (ev) => {
                ev.stopPropagation();
                openFileFromTree(e.path);
            });
        }
        container.appendChild(row);
    }
}

function toggleTreeDir(dirPath, rowEl) {
    const was = state.expandedDirs.has(dirPath);
    
    if (was) {
        state.expandedDirs.delete(dirPath);
        const child = rowEl.nextElementSibling;
        if (child?.classList.contains('tree-children')) child.remove();
        rowEl.querySelector('.tree-chevron').textContent = '▶';
    } else {
        state.expandedDirs.add(dirPath);
        rowEl.querySelector('.tree-chevron').textContent = '▼';
        
        const wrap = document.createElement('div');
        wrap.className = 'tree-children';
        rowEl.after(wrap);
        
        (async () => {
            const res = await window.electronAPI.folder.list(dirPath);
            wrap.innerHTML = '';
            
            if (res.success && res.entries) {
                for (const e of res.entries) {
                    const sub = document.createElement('div');
                    sub.className = 'tree-item' + (e.isDirectory ? ' tree-dir' : ' tree-file');
                    sub.dataset.path = e.path;
                    
                    const icon = e.isDirectory ? '📁' : (e.name.endsWith('.ino') ? '📄' : '📃');
                    const chev = e.isDirectory ? '<span class="tree-chevron">▶</span>' : '<span class="tree-spacer"></span>';
                    sub.innerHTML = `${chev}<span class="tree-icon">${icon}</span><span class="tree-name">${e.name}</span>`;
                    
                    if (e.isDirectory) {
                        sub.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            toggleTreeDir(e.path, sub);
                        });
                    } else {
                        sub.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            openFileFromTree(e.path);
                        });
                    }
                    wrap.appendChild(sub);
                }
            }
        })();
    }
}

// ============================================
// Multi-file tab helpers
// ============================================
function renderFileTabs() {
    const container = document.getElementById('fileTabs');
    if (!container) return;
    
    container.innerHTML = '';
    
    state.openFiles.forEach((file, index) => {
        const tab = document.createElement('div');
        tab.className = 'tab' + (index === state.activeTabIndex ? ' active' : '');
        tab.dataset.tabIndex = String(index);
        
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const icon = ext === 'ino' ? '📄' : '📃';
        
        tab.innerHTML = `
            <span class="tab-icon">${icon}</span>
            <span class="tab-name">${file.name}</span>
            <button type="button" class="tab-close" data-tab-index="${index}" title="Close">×</button>
        `;
        
        tab.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                e.stopPropagation();
                closeTab(parseInt(e.target.dataset.tabIndex, 10));
                return;
            }
            switchToTab(index);
        });
        
        container.appendChild(tab);
    });
}

function addOrFocusFile(filePath, content, name) {
    // Save current tab content before switching
    if (state.editor && state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex]) {
        state.openFiles[state.activeTabIndex].content = state.editor.getValue();
    }
    
    const existing = state.openFiles.findIndex(f => f.path === filePath);
    if (existing >= 0) {
        state.openFiles[existing].content = content;
        state.activeTabIndex = existing;
        renderFileTabs();
        return;
    }
    
    state.openFiles.push({ path: filePath, content, name });
    state.activeTabIndex = state.openFiles.length - 1;
    renderFileTabs();
}

function switchToTab(index) {
    if (index < 0 || index >= state.openFiles.length) return;
    
    // Save current tab content to state
    if (state.editor && state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex]) {
        state.openFiles[state.activeTabIndex].content = state.editor.getValue();
    }
    
    state.activeTabIndex = index;
    const file = state.openFiles[index];
    
    state.currentFile = file.path;
    const ext = (file.path.split('.').pop() || '').toLowerCase();
    state.currentSketch = ext === 'ino' ? file.path : (state.currentSketch && state.openFiles.some(f => f.path === state.currentSketch) ? state.currentSketch : null);
    if (ext === 'ino') window.electronAPI.ui.updateSketchPath(file.path);
    
    if (state.editor) {
        state.editor.setValue(file.content);
        window.electronAPI.ui.updateEditorCode(file.content);
    }
    
    renderFileTabs();
    updateAIContext();
}

function closeTab(index) {
    if (index < 0 || index >= state.openFiles.length) return;
    
    // Save content before closing
    if (state.editor && state.activeTabIndex === index) {
        state.openFiles[index].content = state.editor.getValue();
    }
    
    state.openFiles.splice(index, 1);
    
    if (state.openFiles.length === 0) {
        state.activeTabIndex = -1;
        state.currentFile = null;
        state.currentSketch = null;
        showWelcomeState();
        return;
    }
    
    if (state.activeTabIndex >= state.openFiles.length) {
        state.activeTabIndex = state.openFiles.length - 1;
    } else if (state.activeTabIndex > index) {
        state.activeTabIndex--;
    }
    
    const file = state.openFiles[state.activeTabIndex];
    state.currentFile = file.path;
    const ext = (file.path.split('.').pop() || '').toLowerCase();
    state.currentSketch = ext === 'ino' ? file.path : (state.openFiles.find(f => (f.path.split('.').pop() || '').toLowerCase() === 'ino')?.path || null);
    if (ext === 'ino') window.electronAPI.ui.updateSketchPath(file.path);
    
    if (state.editor) {
        state.editor.setValue(file.content);
        window.electronAPI.ui.updateEditorCode(file.content);
    }
    
    renderFileTabs();
    updateAIContext();
}

async function openFileFromTree(filePath) {
    try {
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        const canEdit = ['ino', 'h', 'hpp', 'cpp', 'c', 'txt', 'json'].includes(ext);
        
        const fileResult = await window.electronAPI.file.read(filePath);
        if (!fileResult.success) {
            logToConsole(`Cannot read: ${filePath}`, 'error');
            return;
        }
        
        const fileName = filePath.split(/[/\\]/).pop();
        
        if (canEdit && state.editor) {
            showEditor();
            addOrFocusFile(filePath, fileResult.content, fileName);
            switchToTab(state.activeTabIndex);
            state.context.activeFile = filePath;
            updateAIContext();
            logToConsole(`Opened: ${fileName}`, 'success');
        }
    } catch (error) {
        logToConsole(`Error opening file: ${error.message}`, 'error');
    }
}

// ============================================
// Library Manager
// ============================================
async function loadInstalledLibs() {
    try {
        const r = await window.electronAPI.lib.list();
        state.installedLibs.clear();
        
        if (r.success && r.data?.installed_libraries) {
            r.data.installed_libraries.forEach(lib => {
                state.installedLibs.set(lib.name, { version: lib.version });
            });
        }
        renderLibList('installed', r.success ? r.data?.installed_libraries : []);
    } catch (e) {
        renderLibList('installed', []);
    }
}

async function libSearch() {
    const q = document.getElementById('libSearchInput')?.value?.trim() || '';
    if (!q) {
        renderLibList('search', []);
        return;
    }
    
    const listEl = document.getElementById('libList');
    if (listEl) listEl.innerHTML = '<div class="lib-msg">Searching...</div>';
    
    try {
        const r = await window.electronAPI.lib.search(q);
        state.libSearchResults = r?.data?.libraries || [];
        await loadInstalledLibs();
        renderLibList('search', state.libSearchResults);
    } catch (e) {
        if (listEl) listEl.innerHTML = `<div class="lib-msg error">${e.message || 'Search failed'}</div>`;
    }
}

async function libUpdateIndex() {
    const btn = document.getElementById('libUpdateIndex');
    if (btn) btn.disabled = true;
    
    try {
        await window.electronAPI.lib.updateIndex();
        logToConsole('Library index updated', 'success');
    } catch (e) {
        logToConsole(`Update index failed: ${e.message}`, 'error');
    }
    
    if (btn) btn.disabled = false;
}

async function libInstallClick(name, version) {
    const spec = version ? `${name}@${version}` : name;
    
    try {
        await window.electronAPI.lib.install(spec);
        logToConsole(`Installed: ${spec}`, 'success');
        state.installedLibs.set(name, { version: version || 'latest' });
        
        if (state.libSearchResults.length) {
            renderLibList('search', state.libSearchResults);
        } else {
            loadInstalledLibs();
        }
    } catch (e) {
        logToConsole(`Install failed: ${e.message}`, 'error');
    }
}

function renderLibList(mode, list) {
    const el = document.getElementById('libList');
    if (!el) return;
    
    if (!list || list.length === 0) {
        el.innerHTML = `<div class="lib-msg">${mode === 'installed' ? 'No installed libraries.' : 'Search for libraries above'}</div>`;
        return;
    }
    
    el.innerHTML = '';
    
    for (const lib of list) {
        const name = lib.name || '';
        const author = lib.author || '';
        const sentence = lib.sentence || '';
        const ver = lib.version || (lib.available_versions && lib.available_versions[0]) || '';
        const versions = lib.available_versions || (ver ? [ver] : []);
        const isInstalled = state.installedLibs.has(name);
        
        const card = document.createElement('div');
        card.className = 'lib-card';
        
        let verOpts = versions.map(v => `<option value="${v}">${v}</option>`).join('');
        if (!verOpts && ver) verOpts = `<option value="${ver}">${ver}</option>`;
        
        const installBtn = isInstalled
            ? `<span class="lib-installed">Installed${lib.version ? ` (${lib.version})` : ''}</span>`
            : (verOpts 
                ? `<select class="lib-version">${verOpts}</select><button class="lib-install-btn" data-name="${name}">Install</button>` 
                : '<span class="lib-msg">No version</span>');
        
        card.innerHTML = `
            <div class="lib-name">${name}</div>
            <div class="lib-meta">${author}</div>
            <div class="lib-sentence">${sentence || ''}</div>
            <div class="lib-actions">${installBtn}</div>
        `;
        
        el.appendChild(card);
        
        const btn = card.querySelector('.lib-install-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                const sel = card.querySelector('.lib-version');
                const v = sel ? sel.value : null;
                libInstallClick(name, v);
            });
        }
    }
}

// ============================================
// Compile & Upload
// ============================================
async function compileSketch() {
    const boardFQBN = document.getElementById('boardSelectSidebar')?.value;

    if (!state.currentSketch) {
        logToConsole('Please open a sketch file first', 'warning');
        showProblem('No sketch file selected. Open a folder and select a .ino file.');
        return;
    }

    if (!boardFQBN) {
        logToConsole('Please select a board', 'warning');
        showProblem('No board selected. Please select a board from the dropdown.');
        return;
    }

    if (state.editor && state.currentSketch) {
        const code = state.editor.getValue();
        await window.electronAPI.file.save(state.currentSketch, code);
        if (state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex]) {
            state.openFiles[state.activeTabIndex].content = code;
        }
    }

    logToConsole('Compiling...', 'info');
    setButtonState('compileBtn', true, 'Compiling...');
    clearProblems();

    try {
        const result = await window.electronAPI.arduino.compile(state.currentSketch, boardFQBN);
        
        if (result.success) {
            logToConsole('Compilation successful!', 'success');
            // Update context awareness
            state.context.lastCompileResult = {
                success: true,
                programSize: result.data?.programSize,
                usagePercent: result.data?.usagePercent,
                warnings: result.data?.warnings || []
            };
            updateAIContext();
            
            if (result.data) {
                if (result.data.programSize) {
                    logToConsole(`Program size: ${result.data.programSize} bytes (${result.data.usagePercent}%)`, 'info');
                }
                if (result.data.warnings && result.data.warnings.length > 0) {
                    result.data.warnings.forEach(w => logToConsole(`Warning: ${w}`, 'warning'));
                }
            }
        } else {
            // Update context awareness - compilation failed
            state.context.lastCompileResult = {
                success: false,
                error: result.error
            };
            updateAIContext();
            logToConsole('Compilation failed!', 'error');
            if (result.error) {
                logToConsole(result.error, 'error');
                showProblem(result.error);
            }
            if (result.analyzedError) {
                displayErrorAnalysis(result.analyzedError);
            }
        }
    } catch (error) {
        logToConsole(`Compilation error: ${error.message}`, 'error');
        showProblem(error.message);
    } finally {
        setButtonState('compileBtn', false, 'Verify');
    }
}

async function uploadSketch() {
    const boardFQBN = document.getElementById('boardSelectSidebar')?.value;
    const port = document.getElementById('portSelectSidebar')?.value;

    if (!state.currentSketch) {
        logToConsole('Please open a sketch file first', 'warning');
        showProblem('No sketch file selected. Open a folder and select a .ino file.');
        return;
    }

    if (!boardFQBN) {
        logToConsole('Please select a board', 'warning');
        showProblem('No board selected. Please select a board from the dropdown.');
        return;
    }

    if (!port) {
        logToConsole('Please select a port', 'warning');
        showProblem('No port selected. Please select a port from the dropdown.');
        return;
    }

    if (state.editor && state.currentSketch) {
        const code = state.editor.getValue();
        await window.electronAPI.file.save(state.currentSketch, code);
        if (state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex]) {
            state.openFiles[state.activeTabIndex].content = code;
        }
    }

    if (state.serialConnected) {
        logToConsole('Disconnecting serial for upload...', 'info');
        await window.electronAPI.serial.disconnect();
    }

    logToConsole('Uploading...', 'info');
    setButtonState('uploadBtn', true, 'Uploading...');
    clearProblems();

    try {
        const result = await window.electronAPI.arduino.upload(state.currentSketch, boardFQBN, port);
        
        if (result.success) {
            logToConsole('Upload successful!', 'success');
            logToConsole(`Uploaded to ${port}`, 'info');
        } else {
            logToConsole('Upload failed!', 'error');
            if (result.error) {
                logToConsole(result.error, 'error');
                showProblem(result.error);
            }
            if (result.analyzedError) {
                displayErrorAnalysis(result.analyzedError);
            }
        }
    } catch (error) {
        logToConsole(`Upload error: ${error.message}`, 'error');
        showProblem(error.message);
    } finally {
        setButtonState('uploadBtn', false, 'Upload');
    }
}

// ============================================
// Serial Monitor Functions
// ============================================
async function toggleSerial() {
    if (state.serialConnected) {
        await disconnectSerial();
    } else {
        await connectSerial();
    }
}

async function connectSerial() {
    const port = document.getElementById('portSelectSidebar')?.value;
    const baudRate = parseInt(document.getElementById('baudRate')?.value || '115200');

    if (!port) {
        logToConsole('Please select a port first', 'warning');
        // Make the issue visible in the Serial panel too
        const statusText = document.getElementById('serialStatusText');
        if (statusText) statusText.textContent = 'Select a port first';
        appendSerialOutput('Select a port first (Board Manager or toolbar).', new Date().toISOString(), 'info');
        return;
    }

    try {
        // Make sure user sees serial output immediately
        document.querySelector('.output-tab[data-tab="serial"]')?.click();
        appendSerialOutput(`Connecting to ${port} @ ${baudRate}...`, new Date().toISOString(), 'info');
        const result = await window.electronAPI.serial.connect(port, baudRate);
        if (!result.success) {
            logToConsole(`Failed to connect: ${result.error}`, 'error');
            appendSerialOutput(`Failed to connect: ${result.error}`, new Date().toISOString(), 'error');
            const statusText = document.getElementById('serialStatusText');
            if (statusText) statusText.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        logToConsole(`Serial connection error: ${error.message}`, 'error');
        appendSerialOutput(`Serial connection error: ${error.message}`, new Date().toISOString(), 'error');
        const statusText = document.getElementById('serialStatusText');
        if (statusText) statusText.textContent = `Error: ${error.message}`;
    }
}

async function disconnectSerial() {
    try {
        await window.electronAPI.serial.disconnect();
    } catch (error) {
        logToConsole(`Disconnect error: ${error.message}`, 'error');
    }
}

async function sendSerialData() {
    const input = document.getElementById('serialInput');
    const data = input?.value;

    if (!data || !state.serialConnected) return;

    try {
        await window.electronAPI.serial.send(data + '\n');
        appendSerialOutput(`> ${data}`, new Date().toISOString(), 'sent');
        input.value = '';
    } catch (error) {
        logToConsole(`Failed to send: ${error.message}`, 'error');
    }
}

function updateSerialUI(connected) {
    const toggleBtn = document.getElementById('toggleSerial');
    const portSelectSidebar = document.getElementById('portSelectSidebar');
    const baudSelect = document.getElementById('baudRate');
    const statusDot = document.getElementById('serialStatusDot');
    const statusText = document.getElementById('serialStatusText');
    
    if (toggleBtn) {
        toggleBtn.textContent = connected ? 'Close Serial Monitor' : 'Open Serial Monitor';
        toggleBtn.classList.toggle('active', connected);
    }
    
    if (statusDot) {
        statusDot.classList.toggle('connected', connected);
    }
    
    if (statusText) {
        const baudRate = document.getElementById('baudRate')?.value || '115200';
        statusText.textContent = connected ? `Connected @ ${baudRate}` : 'Disconnected';
    }
    
    // Disable port selection while connected (can't change port without disconnecting)
    if (portSelectSidebar) portSelectSidebar.disabled = connected;
    
    // Keep baud rate enabled - changing it will auto-reconnect
    // if (baudSelect) baudSelect.disabled = connected;
}

function appendSerialOutput(data, timestamp, type = 'received') {
    const outputEl = document.getElementById('serialOutput');
    if (!outputEl) return;
    
    const time = new Date(timestamp).toLocaleTimeString();
    const prefix = type === 'sent' ? '[TX]' : type === 'error' ? '[ERR]' : type === 'info' ? '[INFO]' : '[RX]';
    const className = type === 'error' ? 'error' : type === 'sent' ? 'sent' : type === 'info' ? 'info' : '';
    
    const line = document.createElement('div');
    line.className = `serial-line ${className}`;
    line.textContent = `[${time}] ${prefix} ${data}`;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
}

// ============================================
// AI Panel Overlay (Top-Right)
// ============================================
function setupAIPanelOverlay() {
    const aiTab = document.getElementById('aiAgentTab');
    const aiPanel = document.getElementById('aiPanel');
    if (aiTab) {
        aiTab.addEventListener('click', () => toggleAIPanel());
    }
    if (aiPanel) {
        aiPanel.addEventListener('click', (e) => {
            if (e.target === aiPanel) toggleAIPanel();
        });
    }
}

// ============================================
// Context Awareness Setup
// ============================================
function setupContextAwareness() {
    // Context updates are handled in syncDropdowns() for sidebar selects
    
    // Update context when file opens
    // (handled in openFileFromTree)
    
    // Update context when serial connects/disconnects
    // (handled in serial listeners)
}

function updateAIContext() {
    // This function can be called by the AI agent to get current context
    // It's also called automatically when context changes
    const context = {
        activeFile: state.currentFile || state.currentSketch,
        selectedBoard: state.context.selectedBoard,
        selectedPort: state.context.selectedPort,
        lastCompileResult: state.context.lastCompileResult,
        currentBaudRate: state.context.currentBaudRate,
        serialConnected: state.serialConnected,
        editorCode: state.editor ? state.editor.getValue() : null
    };
    
    // Store in state for AI agent access
    state.context = { ...state.context, ...context };
    
    // Emit context update event (if needed for AI agent)
    if (window.electronAPI?.ai?.updateContext) {
        window.electronAPI.ai.updateContext(context);
    }
}

// ============================================
// AI Panel Functions (Top-Right Overlay)
// ============================================
function toggleAIPanel() {
    const panel = document.getElementById('aiPanel');
    const tab = document.getElementById('aiAgentTab');
    
    if (panel) {
        state.aiPanelOpen = !state.aiPanelOpen;
        
        if (state.aiPanelOpen) {
            // Open overlay panel
            panel.classList.add('open');
            if (tab) tab.classList.add('active');
        } else {
            // Close overlay panel
            panel.classList.remove('open');
            if (tab) tab.classList.remove('active');
        }
    }
}

// ============================================
// Serial Monitor & Plotter Buttons
// ============================================
function setupSerialButtons() {
    const serialMonitorBtn = document.getElementById('serialMonitorBtn');
    const serialPlotterBtn = document.getElementById('serialPlotterBtn');
    
    if (serialMonitorBtn) {
        serialMonitorBtn.addEventListener('click', () => {
            // Switch to Serial Monitor tab in output panel
            document.querySelector('.output-tab[data-tab="serial"]')?.click();
            // Also open serial panel in sidebar if needed
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('serial');
        });
    }
    
    if (serialPlotterBtn) {
        serialPlotterBtn.addEventListener('click', () => {
            // TODO: Implement Serial Plotter functionality
            logToConsole('Serial Plotter coming soon', 'info');
        });
    }
}

const AI_PREFS_KEY = 'arduino-ide-ai-prefs';
const SESSION_KEY = 'arduino-ide-session';

function saveSession() {
    try {
        const boardSelectSidebar = document.getElementById('boardSelectSidebar');
        const portSelectSidebar = document.getElementById('portSelectSidebar');
        const payload = {
            folderPath: state.folderRoot || null,
            boardFQBN: (boardSelectSidebar && boardSelectSidebar.value) || null,
            port: (portSelectSidebar && portSelectSidebar.value) || null
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Could not save session', e);
    }
}

async function restoreSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const session = JSON.parse(raw);
        if (!session) return;

        // Restore board: only if option exists in loaded list
        let restoredBoardName = null;
        if (session.boardFQBN && state.boards && state.boards.some(b => b.fqbn === session.boardFQBN)) {
            const boardSelectSidebar = document.getElementById('boardSelectSidebar');
            if (boardSelectSidebar) {
                boardSelectSidebar.value = session.boardFQBN;
                state.selectedBoard = session.boardFQBN;
                state.context.selectedBoard = session.boardFQBN;
            }
            const board = state.boards.find(b => b.fqbn === session.boardFQBN);
            if (board) restoredBoardName = board.name;
        }

        // Restore port: only if option exists in loaded list
        let restoredPort = null;
        if (session.port && state.ports && state.ports.some(p => p.port === session.port)) {
            const portSelectSidebar = document.getElementById('portSelectSidebar');
            if (portSelectSidebar) {
                portSelectSidebar.value = session.port;
                state.selectedPort = session.port;
                state.context.selectedPort = session.port;
            }
            restoredPort = session.port;
        }
        if (restoredBoardName || restoredPort) {
            updateBoardPortDisplay(restoredBoardName || null, restoredPort || null);
        }

        // Restore folder: only if path still exists (list succeeds)
        if (session.folderPath && typeof session.folderPath === 'string') {
            const res = await window.electronAPI.folder.list(session.folderPath);
            if (res.success && res.entries) {
                state.folderRoot = session.folderPath;
                state.expandedDirs.clear();
                const label = document.getElementById('folderLabel');
                const name = session.folderPath.split(/[/\\]/).pop() || session.folderPath;
                if (label) {
                    label.innerHTML = `<span class="folder-icon">📁</span><span>${name}</span>`;
                }
                await renderFileTree(session.folderPath);
            }
            // If folder not available: do nothing, boot as is (no folder open)
        }
    } catch (e) {
        console.warn('Could not restore session', e);
    }
}

function saveAIPreferences() {
    try {
        localStorage.setItem(AI_PREFS_KEY, JSON.stringify({
            mode: state.aiMode,
            modelId: state.aiModelId
        }));
    } catch (e) {
        console.warn('Could not save AI preferences', e);
    }
}

function restoreAIPreferences() {
    try {
        const raw = localStorage.getItem(AI_PREFS_KEY);
        if (!raw) return;
        const prefs = JSON.parse(raw);
        if (prefs.mode && ['agent', 'ask', 'debug'].includes(prefs.mode)) {
            state.aiMode = prefs.mode;
            const modeSelect = document.getElementById('aiModeSelect');
            if (modeSelect) modeSelect.value = prefs.mode;
        }
        if (prefs.modelId) {
            state.aiModelId = prefs.modelId;
            const modelSelect = document.getElementById('aiModelSelect');
            if (modelSelect) {
                modelSelect.value = prefs.modelId;
                state.aiProviderConfigured = true;
                updateAIStatus('Model selected');
            }
        }
    } catch (e) {
        console.warn('Could not restore AI preferences', e);
    }
}

async function loadAIUnifiedModels() {
    try {
        const result = await window.electronAPI.ai.getUnifiedModels();
        if (result.success && result.data && result.data.length > 0) {
            state.aiUnifiedModels = result.data;
            const select = document.getElementById('aiModelSelect');
            if (!select) return;
            const firstOption = select.querySelector('option[value=""]');
            select.innerHTML = firstOption ? firstOption.outerHTML : '<option value="">Select model...</option>';
            for (const m of result.data) {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.displayName;
                select.appendChild(opt);
            }
            updateAIStatus('Select a model to get started');
        } else {
            updateAIStatus('No models available');
        }
    } catch (error) {
        console.error('Failed to load AI models:', error);
        updateAIStatus('Could not load models');
    }
}

async function onAIModelChange(e) {
    const modelId = e.target.value;
    if (!modelId) {
        state.aiModelId = null;
        state.aiProviderConfigured = false;
        updateAIStatus('Select a model');
        saveAIPreferences();
        return;
    }
    state.aiModelId = modelId;
    saveAIPreferences();

    try {
        const result = await window.electronAPI.ai.setModel(modelId);
        if (result.success) {
            state.aiProviderConfigured = true;
            updateAIStatus('Ready');
            addAIMessage('assistant', 'Model set. How can I help you with your Arduino project?');
        } else if (result.needsKey && result.provider) {
            state.apiKeyModalProvider = result.provider;
            openAPIKeyModal(result.provider, true);
        } else {
            updateAIStatus(result.error || 'Error setting model');
        }
    } catch (error) {
        updateAIStatus(`Error: ${error.message}`);
    }
}

function openAPIKeyModal(provider, isFirstTime = false) {
    state.apiKeyModalProvider = provider;
    const modal = document.getElementById('apiKeyModal');
    const desc = document.getElementById('apiKeyModalDescription');
    const input = document.getElementById('apiKeyInput');
    if (desc) desc.textContent = isFirstTime
        ? `Enter your API key for ${provider} to use this model.`
        : `Update API key for ${provider}.`;
    if (input) input.value = '';
    if (modal) {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => input?.focus(), 50);
    }
}

function openAPIKeyModalForCurrentProvider() {
    const modelId = document.getElementById('aiModelSelect')?.value;
    if (!modelId) {
        updateAIStatus('Select a model first');
        return;
    }
    let provider = null;
    for (const m of state.aiUnifiedModels) {
        if (m.id === modelId) {
            provider = m.provider;
            break;
        }
    }
    if (!provider) {
        updateAIStatus('Unknown provider for this model');
        return;
    }
    openAPIKeyModal(provider, false);
}

function closeAPIKeyModal() {
    const modal = document.getElementById('apiKeyModal');
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }
    state.apiKeyModalProvider = null;
}

async function saveAPIKeyFromModal() {
    const provider = state.apiKeyModalProvider;
    const input = document.getElementById('apiKeyInput');
    const key = input?.value?.trim();
    if (!provider || !key) {
        closeAPIKeyModal();
        return;
    }
    try {
        const result = await window.electronAPI.ai.setProvider(provider, key, state.aiModelId || undefined);
        closeAPIKeyModal();
        if (result.success) {
            state.aiProviderConfigured = true;
            updateAIStatus('API key saved');
            addAIMessage('assistant', 'API key saved. You can start chatting.');
        } else {
            updateAIStatus(`Error: ${result.error}`);
        }
    } catch (error) {
        updateAIStatus(`Error: ${error.message}`);
    }
}

async function sendAIMessage() {
    const input = document.getElementById('aiInput');
    const message = input?.value?.trim();
    
    if (!message) return;
    
    if (!state.aiProviderConfigured) {
        addAIMessage('assistant', 'Please select a model and enter your API key first.');
        return;
    }
    
    const hasFileOpen = state.currentFile || state.currentSketch;
    
    addAIMessage('user', message);
    input.value = '';
    
    const thinkingId = addAIMessage('assistant', 'Thinking...', true);
    
    const safeRemoveThinking = () => {
        try {
            removeAIMessage(thinkingId);
        } catch (e) {
            console.error('Error removing thinking message:', e);
        }
    };
    
    const timeoutId = setTimeout(() => {
        safeRemoveThinking();
        addAIMessage('assistant', 'Request timed out. Please try again.');
    }, 120000);
    
    try {
        const context = {
            code: hasFileOpen && state.editor ? state.editor.getValue() : '',
            sketchPath: state.currentSketch || null,
            board: document.getElementById('boardSelectSidebar')?.value,
            port: document.getElementById('portSelectSidebar')?.value,
            hasFileOpen: hasFileOpen
        };
        const mode = state.aiMode || 'agent';
        const result = await window.electronAPI.ai.processQuery(message, context, mode);
        
        clearTimeout(timeoutId);
        safeRemoveThinking();
        
        if (result.success && result.data) {
            const response = result.data.response || result.data.content || 'No response received';
            addAIMessage('assistant', response);
            
            if (result.data.toolResults && result.data.toolResults.length > 0) {
                const toolSummary = result.data.toolResults
                    .map(t => `• ${t.tool || 'Action'}: ${t.success ? 'Success' : 'Failed'}`)
                    .join('\n');
                addAIMessage('system', `Actions performed:\n${toolSummary}`);
            }
        } else {
            const errorMsg = result.error || 'Unknown error occurred';
            addAIMessage('assistant', `Error: ${errorMsg}`);
            logToConsole(`AI Error: ${errorMsg}`, 'error');
        }
    } catch (error) {
        clearTimeout(timeoutId);
        safeRemoveThinking();
        
        const errorMsg = error.message || 'An unexpected error occurred';
        addAIMessage('assistant', `Error: ${errorMsg}`);
        logToConsole(`AI Error: ${errorMsg}`, 'error');
    }
}

function addAIMessage(role, content, isTemporary = false) {
    const container = document.getElementById('aiMessages');
    if (!container) return null;
    
    const welcome = container.querySelector('.ai-welcome');
    if (welcome) welcome.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${role}`;
    if (isTemporary) {
        messageDiv.id = 'temp-message-' + Date.now();
    }
    
    const formattedContent = formatAIContent(content);
    messageDiv.innerHTML = formattedContent;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    return messageDiv.id;
}

function removeAIMessage(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
}

function formatAIContent(content) {
    return content
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function updateAIStatus(message) {
    const statusEl = document.getElementById('aiStatus');
    if (statusEl) statusEl.textContent = message;
}

// ============================================
// Console/Output Functions
// ============================================
function logToConsole(message, type = 'info') {
    const consoleEl = document.getElementById('consoleOutput');
    if (!consoleEl) return;
    
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    line.textContent = `[${time}] ${message}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

function showProblem(message) {
    const problemsEl = document.getElementById('problemsOutput');
    if (!problemsEl) return;
    
    const line = document.createElement('div');
    line.className = 'problem-line';
    line.textContent = message;
    problemsEl.appendChild(line);
}

function clearProblems() {
    const problemsEl = document.getElementById('problemsOutput');
    if (problemsEl) problemsEl.innerHTML = '';
}

function displayErrorAnalysis(analysis) {
    if (!analysis) return;
    
    const problemsEl = document.getElementById('problemsOutput');
    if (!problemsEl) return;
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-analysis';
    
    let html = `<h4>Error Analysis</h4>`;
    
    if (analysis.error && analysis.error.pattern) {
        html += `<p><strong>Type:</strong> ${analysis.error.pattern.type}</p>`;
    }
    
    if (analysis.suggestions && analysis.suggestions.length > 0) {
        html += `<h5>Suggestions:</h5><ul>`;
        analysis.suggestions.forEach(s => {
            html += `<li><strong>${s.title}</strong> (${Math.round(s.confidence * 100)}% confidence)<br>${s.solution}</li>`;
        });
        html += `</ul>`;
    }
    
    errorDiv.innerHTML = html;
    problemsEl.appendChild(errorDiv);
    
    document.querySelector('.output-tab[data-tab="problems"]')?.click();
}

// ============================================
// Board/Port Selector Functions
// ============================================
function setupBoardPortSelector() {
    const dropdownBtn = document.getElementById('boardPortDropdown');
    const dropdownMenu = document.getElementById('boardPortDropdownMenu');
    const selectOtherBtn = document.getElementById('selectOtherBoardPort');
    const modal = document.getElementById('boardPortModal');
    const modalClose = document.getElementById('boardPortModalClose');
    const modalCancel = document.getElementById('boardPortModalCancel');
    const modalOk = document.getElementById('boardPortModalOk');
    const boardSearchInput = document.getElementById('boardSearchInput');
    const showAllPorts = document.getElementById('showAllPorts');
    const selector = document.querySelector('.board-port-selector');
    
    // Toggle dropdown menu
    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selector?.classList.toggle('open');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!selector?.contains(e.target)) {
                selector?.classList.remove('open');
            }
        });
    }
    
    // Open modal when "Select other board and port" is clicked
    if (selectOtherBtn && modal) {
        selectOtherBtn.addEventListener('click', () => {
            selector?.classList.remove('open');
            openBoardPortModal();
        });
    }
    
    // Close modal
    if (modalClose) {
        modalClose.addEventListener('click', closeBoardPortModal);
    }
    if (modalCancel) {
        modalCancel.addEventListener('click', closeBoardPortModal);
    }
    
    // Modal OK button
    if (modalOk) {
        modalOk.addEventListener('click', () => {
            const selectedBoard = modal.querySelector('.board-port-list-item.selected[data-board]');
            const selectedPort = modal.querySelector('.board-port-list-item.selected[data-port]');
            
            if (selectedBoard) {
                const boardFQBN = selectedBoard.dataset.board;
                const boardName = selectedBoard.textContent.trim();
                document.getElementById('boardSelectSidebar').value = boardFQBN;
                state.selectedBoard = boardFQBN;
                state.context.selectedBoard = boardFQBN;
                updateBoardPortDisplay(boardName, null);
            }
            
            if (selectedPort) {
                const port = selectedPort.dataset.port;
                document.getElementById('portSelectSidebar').value = port;
                state.selectedPort = port;
                state.context.selectedPort = port;
                const display = document.getElementById('boardPortDisplay');
                const currentText = display.textContent;
                updateBoardPortDisplay(currentText.split(' on ')[0], port);
            }
            
            updateAIContext();
            saveSession();
            closeBoardPortModal();
        });
    }
    
    // Board search
    if (boardSearchInput) {
        boardSearchInput.addEventListener('input', (e) => {
            filterBoardList(e.target.value);
        });
    }
    
    // Show all ports checkbox
    if (showAllPorts) {
        showAllPorts.addEventListener('change', (e) => {
            renderPortList(e.target.checked);
        });
    }
    
    // Load saved options
    loadSavedBoardPortOptions();
}

function openBoardPortModal() {
    const modal = document.getElementById('boardPortModal');
    if (modal) {
        modal.classList.add('open');
        renderBoardList();
        renderPortList(false);
    }
}

function closeBoardPortModal() {
    const modal = document.getElementById('boardPortModal');
    if (modal) {
        modal.classList.remove('open');
        // Clear search
        const searchInput = document.getElementById('boardSearchInput');
        if (searchInput) searchInput.value = '';
        filterBoardList('');
    }
}

function renderBoardList() {
    const boardList = document.getElementById('boardList');
    if (!boardList || !state.boards) return;
    
    boardList.innerHTML = '';
    
    state.boards.forEach(board => {
        const item = document.createElement('div');
        item.className = 'board-port-list-item';
        item.dataset.board = board.fqbn;
        if (state.selectedBoard === board.fqbn) {
            item.classList.add('selected');
        }
        
        item.innerHTML = `
            <img src="../../assets/chip.svg" alt="" class="board-port-list-item-icon board-port-list-item-icon-chip" width="16" height="16">
            <span>${board.name}</span>
        `;
        
        item.addEventListener('click', () => {
            // Toggle selection
            boardList.querySelectorAll('.board-port-list-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
        });
        
        boardList.appendChild(item);
    });
}

function filterBoardList(searchTerm) {
    const items = document.querySelectorAll('#boardList .board-port-list-item');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

function renderPortList(showAll) {
    const portList = document.getElementById('portList');
    if (!portList) return;
    
    portList.innerHTML = '';
    
    const portsToShow = showAll ? state.ports : state.ports.filter(p => p.board || p.protocol === 'serial');
    
    if (portsToShow.length === 0) {
        portList.innerHTML = '<div style="padding: 16px; color: var(--muted-foreground); text-align: center;">No ports available</div>';
        return;
    }
    
    portsToShow.forEach(port => {
        const item = document.createElement('div');
        item.className = 'board-port-list-item';
        item.dataset.port = port.port;
        if (state.selectedPort === port.port) {
            item.classList.add('selected');
        }
        
        item.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="board-port-list-item-icon">
                <path d="M21 16V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2zM7 10h10M7 14h10"/>
            </svg>
            <span>${port.port} ${port.board ? `- ${port.board}` : ''}</span>
        `;
        
        item.addEventListener('click', () => {
            // Toggle selection
            portList.querySelectorAll('.board-port-list-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
        });
        
        portList.appendChild(item);
    });
}

function loadSavedBoardPortOptions() {
    const savedOptions = document.getElementById('boardPortSavedOptions');
    if (!savedOptions) return;
    
    // Get current selection
    const currentBoard = state.selectedBoard;
    const currentPort = state.selectedPort;
    
    if (currentBoard || currentPort) {
        const board = state.boards.find(b => b.fqbn === currentBoard);
        const port = state.ports.find(p => p.port === currentPort);
        
        if (board || port) {
            const option = document.createElement('div');
            option.className = 'board-port-saved-option selected';
            option.innerHTML = `
                <span>${board ? board.name : 'No board'}${port ? ` on ${port.port}` : ''}</span>
            `;
            
            option.addEventListener('click', () => {
                if (board) {
                    document.getElementById('boardSelectSidebar').value = board.fqbn;
                    state.selectedBoard = board.fqbn;
                    state.context.selectedBoard = board.fqbn;
                }
                if (port) {
                    document.getElementById('portSelectSidebar').value = port.port;
                    state.selectedPort = port.port;
                    state.context.selectedPort = port.port;
                }
                updateBoardPortDisplay(board?.name || 'No board', port?.port || null);
                updateAIContext();
                document.querySelector('.board-port-selector')?.classList.remove('open');
            });
            
            savedOptions.appendChild(option);
        }
    }
}

function updateBoardPortDisplay(boardName, port) {
    const display = document.getElementById('boardPortDisplay');
    if (display) {
        if (boardName && port) {
            display.textContent = `${boardName} on ${port}`;
        } else if (boardName) {
            display.textContent = boardName;
        } else {
            display.textContent = 'Select Board and Port';
        }
    }
}

// ============================================
// Helper Functions
// ============================================
function setButtonState(buttonId, disabled, text) {
    const btn = document.getElementById(buttonId);
    if (btn) {
        btn.disabled = disabled;
        const svg = btn.querySelector('svg');
        const svgHtml = svg ? svg.outerHTML : '';
        btn.innerHTML = `${svgHtml} ${text}`;
    }
}
