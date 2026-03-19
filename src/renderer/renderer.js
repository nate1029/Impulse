// ============================================
// Impulse IDE - Renderer
// Modern UI with Activity Bar & Panels
// ============================================

import { getCodeMirror } from './codemirror-ref.js';

// UI State — exposed on window so other modules (validation.js, etc.) can access it
// without relying on bundler scope-hoisting accidents.
let state = window.state = {
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
    aiPanelMinimized: false,
    aiPanelWidth: 400,
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
    // Serial Plotter state
    plotter: {
        data: [],          // Array of { timestamp, values: number[] }
        maxPoints: 500,
        paused: false,
        animFrameId: null,
        channelCount: 0,
        running: false
    },
    // Context awareness state
    context: {
        activeFile: null,
        selectedBoard: null,
        selectedPort: null,
        lastCompileResult: null,
        currentBaudRate: 115200,
        serialConnected: false
    },
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof window.electronAPI === 'undefined') {
        const msg = 'Preload did not run — electronAPI is missing. Restart the app or run via npm start / npm run dev.';
        console.error(msg);
        document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;max-width:520px;"><h2>Impulse IDE</h2><p style="color:#c00;">' + msg + '</p><p>Check the terminal and DevTools console for errors.</p></div>';
        return;
    }
    if (!getCodeMirror()) {
        const msg = 'CodeMirror failed to load. Check the console for module errors.';
        console.error(msg);
        document.body.innerHTML = '<div style="font-family:sans-serif;padding:40px;max-width:520px;"><h2>Impulse IDE</h2><p style="color:#c00;">' + msg + '</p></div>';
        return;
    }
    try {
        initializeCodeMirror();
        await checkArduinoCLI();
        await loadBoards();
        await loadPorts();
        await loadAIUnifiedModels();
        await restoreAIPreferences();
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
        setupUserApiKeys();
        syncDropdowns();
        setupAIPanelOverlay();
        setupAIPanelResize();
        setupContextAwareness();
        setupSerialButtons();
        setupSerialPlotter();
        setupPlayground();
        setupAutoSave();
        setupResizers();
        restoreAIPanelState();
        setupCodeBlockActions();
        setupRevertButtonHandler();
        setupUpdater();

        logToConsole('Impulse IDE initialized', 'info');
    } catch (err) {
        console.error('Impulse IDE init error:', err);
        const existing = document.getElementById('init-error-msg');
        if (!existing) {
            const div = document.createElement('div');
            div.id = 'init-error-msg';
            div.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:12px;background:#c00;color:#fff;font-family:sans-serif;z-index:9999;';
            div.textContent = 'Init error: ' + (err && err.message ? err.message : String(err)) + ' — check DevTools console.';
            document.body.prepend(div);
        }
    }
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
    if (panelId === 'boards') {
        loadInstalledCores();
    }
    if (panelId === 'debug') {
        updateDebugPanel();
    }
    if (panelId === 'search') {
        document.getElementById('searchInput')?.focus();
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
        // Clear inline width/flexBasis so CSS can control width (collapsed => 0, expanded => var(--sidebar-width))
        sidebar.style.width = '';
        sidebar.style.flexBasis = '';
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
        // Ctrl+Shift+M: Serial Monitor (switch panel + click button)
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            e.preventDefault();
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('serial');
            document.getElementById('serialMonitorBtn')?.click();
        }
        // Ctrl+Shift+A: AI Panel
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            toggleAIPanel();
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
        case 'file-examples':
            showExamplesDropdown();
            break;
        case 'file-sketchbook':
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
        case 'sketch-add-tab':
            addTabToSketch();
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
            document.querySelector('.output-tab[data-tab="plotter"]')?.click();
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('serial');
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
        // Help — open Arduino docs in browser
        case 'help-getting-started':
            openHelpUrl('https://docs.arduino.cc/learn/getting-started');
            break;
        case 'help-environment':
            openHelpUrl('https://docs.arduino.cc/learn/development/welcome-to-arduino');
            break;
        case 'help-troubleshooting':
            openHelpUrl('https://support.arduino.cc/hc/en-us');
            break;
        case 'help-reference':
            openHelpUrl('https://www.arduino.cc/reference/en/');
            break;
        case 'help-find-reference':
            openFindInReference();
            break;
        case 'help-faq':
            openHelpUrl('https://support.arduino.cc/hc/en-us/categories/360000522940-FAQ');
            break;
        case 'help-visit-arduino':
            openHelpUrl('https://www.arduino.cc');
            break;
        case 'help-about':
            showAbout();
            break;
        default:
            break;
    }
}

async function newSketch() {
    if (!window.electronAPI?.dialog?.saveNewSketch) {
        showWelcomeState();
        state.folderRoot = null;
        const label = document.getElementById('folderLabel');
        if (label) label.innerHTML = '<span class="folder-icon">📁</span><span>No folder open</span>';
        document.getElementById('fileTree').innerHTML = '';
        logToConsole('New sketch — open a folder to start', 'info');
        return;
    }
    try {
        const result = await window.electronAPI.dialog.saveNewSketch();
        if (result.canceled || !result.success) {
            if (!result.canceled) logToConsole(result.error || 'Could not create sketch', 'error');
            return;
        }
        state.folderRoot = result.folderPath;
        state.expandedDirs.clear();
        const label = document.getElementById('folderLabel');
        const name = result.folderPath.split(/[/\\]/).pop() || result.folderPath;
        if (label) label.innerHTML = `<span class="folder-icon">📁</span><span>${escapeHtml(name)}</span>`;
        await renderFileTree(result.folderPath);
        const fileResult = await window.electronAPI.file.read(result.filePath);
        const content = fileResult.success ? fileResult.content : '';
        const fileName = result.sketchName || result.filePath.split(/[/\\]/).pop();
        showEditor();
        addOrFocusFile(result.filePath, content, fileName);
        switchToTab(state.openFiles.length - 1);
        saveSession();
        logToConsole(`New sketch created: ${fileName}`, 'success');
    } catch (e) {
        logToConsole(`New sketch error: ${e.message}`, 'error');
    }
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

// ============================================
// Playground Panel
// ============================================
function setupPlayground() {
    const entriesEl = document.getElementById('playgroundEntries');
    const clearBtn = document.getElementById('playgroundClearBtn');

    if (!entriesEl) return;

    // Show empty state initially
    showPlaygroundEmpty();

    function showPlaygroundEmpty() {
        entriesEl.innerHTML = '<div class="playground-empty">AI hardware tasks will appear here</div>';
    }

    function addEntry(content) {
        // Remove empty state if present
        const emptyEl = entriesEl.querySelector('.playground-empty');
        if (emptyEl) emptyEl.remove();

        const entry = document.createElement('div');
        entry.className = 'playground-entry';

        const header = document.createElement('div');
        header.className = 'playground-entry-header';
        const now = new Date();
        header.textContent = `Step ${entriesEl.querySelectorAll('.playground-entry').length + 1} — ${now.toLocaleTimeString()}`;

        const body = document.createElement('div');
        body.textContent = content;

        entry.appendChild(header);
        entry.appendChild(body);
        entriesEl.appendChild(entry);

        // Auto-scroll to bottom
        entriesEl.scrollTop = entriesEl.scrollHeight;
    }

    function replaceAll(content) {
        entriesEl.innerHTML = '';
        addEntry(content);
    }

    function switchToPlaygroundTab() {
        const tabs = document.querySelectorAll('.output-tab');
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.output-content').forEach(c => c.classList.remove('active'));

        const playgroundTab = document.querySelector('.output-tab[data-tab="playground"]');
        const playgroundContent = document.getElementById('playgroundOutput');
        if (playgroundTab) playgroundTab.classList.add('active');
        if (playgroundContent) playgroundContent.classList.add('active');

        // Hide serial input row
        const serialInputRow = document.getElementById('serialInputRow');
        if (serialInputRow) serialInputRow.style.display = 'none';

        // Stop plotter rendering
        if (typeof stopPlotterRendering === 'function') stopPlotterRendering();
    }

    // Listen for playground updates from the AI agent via IPC
    if (window.electronAPI && window.electronAPI.ui && window.electronAPI.ui.onPlaygroundUpdate) {
        window.electronAPI.ui.onPlaygroundUpdate((content, append) => {
            if (append === false) {
                replaceAll(content);
            } else {
                addEntry(content);
            }
            // Auto-switch to the Playground tab
            switchToPlaygroundTab();
        });
    }

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            showPlaygroundEmpty();
        });
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

async function saveFileAs() {
    if (!state.currentFile && !state.editor) {
        logToConsole('No file open', 'warning');
        return;
    }
    const content = state.editor ? state.editor.getValue() : (state.activeTabIndex >= 0 && state.openFiles[state.activeTabIndex] ? state.openFiles[state.activeTabIndex].content : '');
    if (!window.electronAPI?.dialog?.saveAsSketch) {
        logToConsole('Save As: open a folder and save there', 'info');
        return;
    }
    try {
        const result = await window.electronAPI.dialog.saveAsSketch(content);
        if (result.canceled || !result.success) {
            if (!result.canceled) logToConsole(result.error || 'Save As failed', 'error');
            return;
        }
        state.folderRoot = result.folderPath;
        state.expandedDirs.clear();
        const label = document.getElementById('folderLabel');
        const name = result.folderPath.split(/[/\\]/).pop() || result.folderPath;
        if (label) label.innerHTML = `<span class="folder-icon">📁</span><span>${escapeHtml(name)}</span>`;
        await renderFileTree(result.folderPath);
        const fileName = result.sketchName || result.filePath.split(/[/\\]/).pop();
        showEditor();
        addOrFocusFile(result.filePath, content, fileName);
        switchToTab(state.openFiles.length - 1);
        saveSession();
        logToConsole(`Saved as: ${fileName}`, 'success');
    } catch (e) {
        logToConsole(`Save As error: ${e.message}`, 'error');
    }
}

function showPreferences() {
    openHelpUrl('https://docs.arduino.cc/software/ide-v1/tutorials/ide-v1-setting-up-the-arduino-ide');
    logToConsole('Preferences: see Arduino docs. Editor font size: Edit menu', 'info');
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
    const pathToShow = state.currentSketch || state.folderRoot;
    if (pathToShow && window.electronAPI?.shell?.showItemInFolder) {
        window.electronAPI.shell.showItemInFolder(pathToShow).then((r) => {
            if (r && !r.success) logToConsole(r.error || 'Could not show folder', 'warning');
        }).catch(() => logToConsole('Could not show sketch folder', 'warning'));
    } else if (state.folderRoot) {
        logToConsole(`Sketch folder: ${state.folderRoot}`, 'info');
    } else {
        logToConsole('Open a folder or sketch first', 'warning');
    }
}

function addFileToSketch() {
    if (!state.folderRoot) {
        logToConsole('Open a sketch folder first', 'warning');
        return;
    }
    logToConsole('Add File: use File > Open to add an existing file, or Add Tab for a new .ino tab', 'info');
}

async function addTabToSketch() {
    if (!state.folderRoot) {
        logToConsole('Open a sketch folder first', 'warning');
        return;
    }
    const existingNames = state.openFiles.map(f => f.name);
    let defaultName = 'tab2.ino';
    for (let i = 2; i < 100; i++) {
        if (!existingNames.includes(`tab${i}.ino`)) {
            defaultName = `tab${i}.ino`;
            break;
        }
    }
    const name = prompt('New tab name (.ino):', defaultName);
    if (name == null || !name.trim()) return;
    let base = name.trim();
    if (!base.toLowerCase().endsWith('.ino')) base += '.ino';
    const sep = state.folderRoot.includes('\\') ? '\\' : '/';
    const root = state.folderRoot.endsWith(sep) ? state.folderRoot : state.folderRoot + sep;
    const filePath = root + base;
    const content = '';
    try {
        const result = await window.electronAPI.file.save(filePath, content);
        if (!result || !result.success) {
            logToConsole(result?.error || 'Could not create file', 'error');
            return;
        }
        showEditor();
        addOrFocusFile(filePath, content, base);
        switchToTab(state.openFiles.length - 1);
        await renderFileTree(state.folderRoot);
        logToConsole(`Added tab: ${base}`, 'success');
    } catch (e) {
        logToConsole(`Add tab error: ${e.message}`, 'error');
    }
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
        logToConsole('Select a port first (Board Manager or Tools > Port)', 'warning');
        document.getElementById('boardPortDropdown')?.click();
        return;
    }
    logToConsole(`Board info for ${port}: use Arduino CLI or device manager for VID/PID details`, 'info');
}

function showAbout() {
    logToConsole('Impulse IDE — hybrid Arduino IDE with AI assistant', 'info');
}

function openHelpUrl(url) {
    if (typeof window.electronAPI !== 'undefined' && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url).catch(() => logToConsole('Could not open link', 'warning'));
    }
}

function openFindInReference() {
    let term = '';
    if (state.editor) {
        const sel = state.editor.getSelection();
        if (sel && sel.length) term = sel;
        else {
            const cursor = state.editor.getCursor();
            const token = state.editor.getTokenAt ? state.editor.getTokenAt(cursor) : null;
            if (token && token.string) term = token.string;
        }
    }
    const base = 'https://www.arduino.cc/reference/en/';
    const url = term ? `${base}?q=${encodeURIComponent(term)}` : base;
    openHelpUrl(url);
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
// Auto-updater UI
// ============================================
function setupUpdater() {
    if (!window.electronAPI?.updater) return;

    const banner = document.getElementById('updaterBanner');
    const textEl = document.getElementById('updaterBannerText');
    const downloadBtn = document.getElementById('updaterDownloadBtn');
    const restartBtn = document.getElementById('updaterRestartBtn');
    const dismissBtn = document.getElementById('updaterDismissBtn');

    if (!banner || !textEl) return;

    function showBanner(message, showDownload, showRestart) {
        banner.classList.remove('hidden');
        textEl.textContent = message;
        if (downloadBtn) {
            downloadBtn.classList.toggle('hidden', !showDownload);
        }
        if (restartBtn) {
            restartBtn.classList.toggle('hidden', !showRestart);
        }
    }

    function hideBanner() {
        banner.classList.add('hidden');
    }

    const unsubscribe = window.electronAPI.updater.onStatus((status, data) => {
        if (status === 'available') {
            const version = data?.version ? ` (${data.version})` : '';
            showBanner(`Update available${version}.`, true, false);
        } else if (status === 'progress') {
            const pct = data?.percent != null ? data.percent : 0;
            showBanner(`Downloading update… ${pct}%`, false, false);
        } else if (status === 'downloaded') {
            showBanner('Update ready. Restart the app to install.', false, true);
        } else if (status === 'error') {
            showBanner(data?.message || 'Update check failed.', false, false);
        } else if (status === 'checking' || status === 'not-available') {
            hideBanner();
        }
    });

    downloadBtn?.addEventListener('click', () => {
        window.electronAPI.updater.download();
    });
    restartBtn?.addEventListener('click', () => {
        window.electronAPI.updater.install();
    });
    dismissBtn?.addEventListener('click', hideBanner);
}

// ============================================
// User API Keys Management
// ============================================
function setupUserApiKeys() {
    const userBtn = document.getElementById('userBtn');
    const modal = document.getElementById('userKeysModal');
    const modalClose = document.getElementById('userKeysModalClose');
    const keysList = document.getElementById('userKeysList');
    const statusEl = document.getElementById('userKeysStatus');

    if (!userBtn || !modal) return;

    // Provider definitions
    const providers = [
        { id: 'gemini',  label: 'Google Gemini',  placeholder: 'AIza...' },
        { id: 'openai',  label: 'OpenAI',         placeholder: 'sk-...' },
        { id: 'claude',  label: 'Anthropic Claude', placeholder: 'sk-ant-...' }
    ];

    // --- Helpers ---
    function openModal() {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        renderKeys();
    }

    function closeModal() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        clearStatus();
    }

    function showStatus(msg, type) {
        statusEl.textContent = msg;
        statusEl.className = 'user-keys-status ' + (type || '');
        if (type === 'success') {
            setTimeout(() => {
                if (statusEl.textContent === msg) clearStatus();
            }, 3000);
        }
    }

    function clearStatus() {
        statusEl.textContent = '';
        statusEl.className = 'user-keys-status';
    }

    function updateUserButton(hasAnyKey) {
        if (hasAnyKey) {
            userBtn.classList.add('has-keys');
            userBtn.title = 'API Keys (configured)';
        } else {
            userBtn.classList.remove('has-keys');
            userBtn.title = 'API Keys';
        }
    }

    // --- Render key rows ---
    async function renderKeys() {
        keysList.innerHTML = '';
        let hasAny = false;

        // Fetch saved keys status
        let savedKeys = {};
        try {
            const result = await window.electronAPI.apiKeys.list();
            if (result.success) savedKeys = result.data || {};
        } catch (_) { /* ignore */ }

        for (const prov of providers) {
            const isSaved = !!(savedKeys[prov.id] && savedKeys[prov.id].hasKey);
            const maskedKey = isSaved ? savedKeys[prov.id].key : '';
            if (isSaved) hasAny = true;

            const row = document.createElement('div');
            row.className = 'user-key-row';

            // Label + badge
            const labelRow = document.createElement('div');
            labelRow.className = 'user-key-label';

            const labelText = document.createElement('span');
            labelText.className = 'user-key-label-text';
            labelText.textContent = prov.label;

            const badge = document.createElement('span');
            badge.className = 'user-key-badge ' + (isSaved ? 'saved' : 'empty');
            badge.textContent = isSaved ? maskedKey : 'NOT SET';

            labelRow.appendChild(labelText);
            labelRow.appendChild(badge);

            // Input + buttons
            const inputRow = document.createElement('div');
            inputRow.className = 'user-key-input-row';

            const input = document.createElement('input');
            input.type = 'password';
            input.className = 'user-key-input';
            input.placeholder = isSaved ? 'Enter new key to replace' : prov.placeholder;
            input.autocomplete = 'off';
            input.dataset.provider = prov.id;

            const saveBtn = document.createElement('button');
            saveBtn.className = 'user-key-save-btn';
            saveBtn.textContent = 'Save';
            saveBtn.addEventListener('click', () => saveKey(prov.id, input, badge));

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') saveBtn.click();
            });

            inputRow.appendChild(input);
            inputRow.appendChild(saveBtn);

            if (isSaved) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'user-key-remove-btn';
                removeBtn.title = 'Remove key';
                removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
                removeBtn.addEventListener('click', () => removeKey(prov.id));
                inputRow.appendChild(removeBtn);
            }

            row.appendChild(labelRow);
            row.appendChild(inputRow);
            keysList.appendChild(row);
        }

        updateUserButton(hasAny);
    }

    // --- Save a key ---
    async function saveKey(providerId, inputEl, badgeEl) {
        const key = inputEl.value.trim();
        if (!key) {
            showStatus('Enter a key first.', 'error');
            return;
        }
        clearStatus();
        try {
            const result = await window.electronAPI.apiKeys.set(providerId, key);
            if (result.success) {
                inputEl.value = '';
                showStatus(`${providerId} key saved.`, 'success');
                renderKeys(); // refresh badges

                // Auto-initialize the AI provider if a matching model is selected
                if (state.aiModelId) {
                    try {
                        const setResult = await window.electronAPI.ai.setModel(state.aiModelId);
                        if (setResult.success) {
                            state.aiProviderConfigured = true;
                            updateAIStatus('Ready');
                        }
                    } catch (_) { /* silent */ }
                }
            } else {
                showStatus(result.error || 'Failed to save key.', 'error');
            }
        } catch (err) {
            showStatus(err.message || 'Save error.', 'error');
        }
    }

    // --- Remove a key ---
    async function removeKey(providerId) {
        clearStatus();
        try {
            const result = await window.electronAPI.apiKeys.remove(providerId);
            if (result.success) {
                showStatus(`${providerId} key removed.`, 'success');
                renderKeys();
            } else {
                showStatus(result.error || 'Failed to remove key.', 'error');
            }
        } catch (err) {
            showStatus(err.message || 'Remove error.', 'error');
        }
    }

    // --- Check for keys on load (for the green dot) ---
    async function checkKeysOnLoad() {
        try {
            const result = await window.electronAPI.apiKeys.list();
            if (result.success) {
                const hasAny = Object.values(result.data || {}).some(v => v.hasKey);
                updateUserButton(hasAny);
            }
        } catch (_) { /* ignore */ }
    }

    // --- Event Listeners ---
    userBtn.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Check on startup
    checkKeysOnLoad();
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
let arduinoHintRegistered = false;

function registerArduinoHint(CodeMirror) {
    if (arduinoHintRegistered) return;
    arduinoHintRegistered = true;
    CodeMirror.registerHelper("hint", "arduino", function (editor, options) {
        const keywords = [
            "setup", "loop", "if", "else", "while", "for", "switch", "case", "break", "continue", "return",
            "pinMode", "digitalWrite", "digitalRead", "analogRead", "analogWrite",
            "Serial", "begin", "println", "print", "available", "read", "write", "flush",
            "delay", "millis", "micros", "delayMicroseconds",
            "HIGH", "LOW", "INPUT", "OUTPUT", "INPUT_PULLUP",
            "int", "float", "char", "bool", "void", "String", "const", "static", "unsigned", "long", "byte",
            "true", "false", "null", "include", "define"
        ];

        const cur = editor.getCursor();
        const token = editor.getTokenAt(cur);
        const start = token.start;
        const end = cur.ch;
        const word = token.string.slice(0, end - start);

        if (!word.match(/^[a-zA-Z0-9_]+$/)) return { list: [], from: CodeMirror.Pos(cur.line, start), to: CodeMirror.Pos(cur.line, end) };

        const list = keywords.filter(k => k.toLowerCase().startsWith(word.toLowerCase()));

        const anyword = CodeMirror.hint.anyword(editor, options);
        if (anyword && anyword.list) {
            anyword.list.forEach(w => {
                if (!list.includes(w)) list.push(w);
            });
        }

        return {
            list: list,
            from: CodeMirror.Pos(cur.line, start),
            to: CodeMirror.Pos(cur.line, end)
        };
    });
}

function initializeCodeMirror() {
    const CodeMirror = getCodeMirror();
    if (!CodeMirror) return;

    const textarea = document.getElementById('codeEditor');
    if (!textarea) return;

    registerArduinoHint(CodeMirror);

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
        styleActiveLine: true,
        extraKeys: { "Ctrl-Space": "autocomplete" },
        hintOptions: { hint: CodeMirror.hint.arduino }
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

    setupBoardManagerPanel();
    setupExamplesDropdown();
    setupDebugPanel();
    setupSearchPanel();

    // Compile and Upload
    document.getElementById('compileBtn')?.addEventListener('click', compileSketch);
    document.getElementById('uploadBtn')?.addEventListener('click', uploadSketch);

    // Board/Port Selector
    setupBoardPortSelector();

    // Serial monitor
    document.getElementById('toggleSerial')?.addEventListener('click', toggleSerial);
    document.getElementById('sendSerial')?.addEventListener('click', sendSerialData);
    document.getElementById('serialInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendSerialData();
    });

    // Baud rate change handler (shared for both sidebar and serial monitor dropdowns)
    async function handleBaudRateChange(baudRate) {
        state.context.currentBaudRate = baudRate;
        window.electronAPI.ui.updateBaudRate(baudRate);
        updateAIContext();

        // Sync both dropdowns
        const sidebarBaud = document.getElementById('baudRate');
        const serialBaud = document.getElementById('serialBaudRate');
        if (sidebarBaud) sidebarBaud.value = baudRate.toString();
        if (serialBaud) serialBaud.value = baudRate.toString();

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
    }

    // Sidebar baud rate dropdown
    document.getElementById('baudRate')?.addEventListener('change', async (e) => {
        const baudRate = parseInt(e.target.value);
        await handleBaudRateChange(baudRate);
    });

    // Serial monitor toolbar baud rate dropdown
    document.getElementById('serialBaudRate')?.addEventListener('change', async (e) => {
        const baudRate = parseInt(e.target.value);
        await handleBaudRateChange(baudRate);
    });

    // Serial monitor clear button
    document.getElementById('serialClearBtn')?.addEventListener('click', () => {
        const contentArea = document.querySelector('#serialOutput .serial-output-content');
        if (contentArea) {
            contentArea.innerHTML = '';
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
        // Feed data to Serial Plotter
        feedPlotterData(data.data);
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
        const sidebarBaud = document.getElementById('baudRate');
        const serialBaud = document.getElementById('serialBaudRate');
        if (sidebarBaud) sidebarBaud.value = baudRate.toString();
        if (serialBaud) serialBaud.value = baudRate.toString();
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

            // Show serial input for serial and plotter tabs
            const serialInputRow = document.getElementById('serialInputRow');
            if (serialInputRow) {
                serialInputRow.style.display = (tabName === 'serial' || tabName === 'plotter') ? 'flex' : 'none';
            }

            // Start/stop plotter rendering
            if (tabName === 'plotter') {
                startPlotterRendering();
            } else {
                stopPlotterRendering();
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
                    `<option value="${escapeHtml(board.fqbn)}">${escapeHtml(board.name)}</option>`
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
                        `<option value="${escapeHtml(port.port)}">${escapeHtml(port.port)} - ${escapeHtml(port.board || 'Unknown')}</option>`
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
// Board Manager (install/uninstall cores)
// ============================================
function setupBoardManagerPanel() {
    const searchInput = document.getElementById('coreSearchInput');
    const searchBtn = document.getElementById('coreSearchBtn');
    const resultsEl = document.getElementById('coreSearchResults');
    const installedEl = document.getElementById('coreInstalledList');

    if (searchBtn) searchBtn.addEventListener('click', runCoreSearch);
    if (searchInput) searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runCoreSearch(); });
}

async function loadInstalledCores() {
    const el = document.getElementById('coreInstalledList');
    if (!el) return;
    el.innerHTML = '<div class="lib-msg">Loading...</div>';
    try {
        const result = await window.electronAPI.arduino.coreList();
        const list = result.success && result.data ? result.data : [];
        if (list.length === 0) {
            el.innerHTML = '<div class="lib-msg">No cores installed. Search above to install (e.g. esp32, arduino:avr).</div>';
            return;
        }
        el.innerHTML = list.map(item => {
            const id = item.id || item.platform?.id || item.name || '';
            const name = item.name || item.platform?.name || id;
            const ver = item.installed || item.version || '';
            return `<div class="core-item installed">
                <span class="core-name">${escapeHtml(name)}</span>
                <span class="core-version">${escapeHtml(ver)}</span>
                <button type="button" class="btn-small core-uninstall-btn" data-core-id="${escapeHtml(id)}">Uninstall</button>
            </div>`;
        }).join('');
        el.querySelectorAll('.core-uninstall-btn').forEach(btn => {
            btn.addEventListener('click', () => coreUninstallClick(btn.dataset.coreId));
        });
    } catch (e) {
        el.innerHTML = `<div class="lib-msg error">${escapeHtml(e.message)}</div>`;
    }
}

async function runCoreSearch() {
    const input = document.getElementById('coreSearchInput');
    const el = document.getElementById('coreSearchResults');
    if (!el) return;
    const keyword = (input?.value || '').trim() || 'arduino';
    el.innerHTML = '<div class="lib-msg">Searching...</div>';
    try {
        const result = await window.electronAPI.arduino.coreSearch(keyword);
        const list = result.success && result.data ? result.data : [];
        if (list.length === 0) {
            el.innerHTML = '<div class="lib-msg">No results. Try "esp32", "samd", or "arduino".</div>';
            return;
        }
        el.innerHTML = list.slice(0, 30).map(item => {
            const id = item.id || item.platform?.id || item.name || '';
            const name = item.name || item.platform?.name || id;
            const latest = item.latest || item.version || '';
            return `<div class="core-item">
                <span class="core-name">${escapeHtml(name)}</span>
                <span class="core-version">${escapeHtml(latest)}</span>
                <button type="button" class="btn-small core-install-btn" data-core-id="${escapeHtml(id)}">Install</button>
            </div>`;
        }).join('');
        el.querySelectorAll('.core-install-btn').forEach(btn => {
            btn.addEventListener('click', () => coreInstallClick(btn.dataset.coreId));
        });
    } catch (e) {
        el.innerHTML = `<div class="lib-msg error">${escapeHtml(e.message)}</div>`;
    }
}

async function coreInstallClick(coreId) {
    if (!coreId) return;
    logToConsole(`Installing core: ${coreId}...`, 'info');
    const resultsEl = document.getElementById('coreSearchResults');
    if (resultsEl) resultsEl.innerHTML = '<div class="lib-msg">Installing... (may take a minute)</div>';
    try {
        const result = await window.electronAPI.arduino.coreInstall(coreId);
        if (result.success) {
            logToConsole(`Installed: ${coreId}`, 'success');
            await loadBoards();
            loadInstalledCores();
            runCoreSearch();
        } else {
            logToConsole(result.error || 'Install failed', 'error');
            if (resultsEl) resultsEl.innerHTML = `<div class="lib-msg error">${escapeHtml(result.error)}</div>`;
        }
    } catch (e) {
        logToConsole(e.message || 'Install failed', 'error');
        if (resultsEl) resultsEl.innerHTML = `<div class="lib-msg error">${escapeHtml(e.message)}</div>`;
    }
}

async function coreUninstallClick(coreId) {
    if (!coreId) return;
    if (!confirm(`Uninstall core "${coreId}"?`)) return;
    logToConsole(`Uninstalling: ${coreId}...`, 'info');
    try {
        const result = await window.electronAPI.arduino.coreUninstall(coreId);
        if (result.success) {
            logToConsole(`Uninstalled: ${coreId}`, 'success');
            await loadBoards();
            loadInstalledCores();
        } else {
            logToConsole(result.error || 'Uninstall failed', 'error');
        }
    } catch (e) {
        logToConsole(e.message || 'Uninstall failed', 'error');
    }
}

// ============================================
// Examples (from installed libraries)
// ============================================
function setupExamplesDropdown() {
    const dropdown = document.getElementById('examplesDropdown');
    const closeBtn = document.getElementById('examplesDropdownClose');
    const loadBtn = document.getElementById('examplesDropdownLoad');
    const listEl = document.getElementById('examplesDropdownList');
    const filterInput = document.getElementById('examplesDropdownFilter');

    closeBtn?.addEventListener('click', hideExamplesDropdown);
    loadBtn?.addEventListener('click', () => loadExamplesIntoDropdown(listEl, filterInput?.value?.trim()).catch(() => { }));
    filterInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadExamplesIntoDropdown(listEl, filterInput.value.trim()).catch(() => { });
    });
    dropdown?.addEventListener('click', (e) => {
        if (e.target === dropdown) hideExamplesDropdown();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdown?.getAttribute('aria-hidden') !== 'true') hideExamplesDropdown();
    });
}

function showExamplesDropdown() {
    const dropdown = document.getElementById('examplesDropdown');
    if (!dropdown) return;
    dropdown.setAttribute('aria-hidden', 'false');
    dropdown.classList.add('open');
    const listEl = document.getElementById('examplesDropdownList');
    listEl.innerHTML = '<div class="lib-msg">Click "Load examples" to list examples from installed libraries.</div>';
}

function hideExamplesDropdown() {
    const dropdown = document.getElementById('examplesDropdown');
    if (!dropdown) return;
    dropdown.setAttribute('aria-hidden', 'true');
    dropdown.classList.remove('open');
}

async function loadExamplesIntoDropdown(listEl, filter = '') {
    if (!listEl) return;
    listEl.innerHTML = '<div class="lib-msg">Loading examples...</div>';
    try {
        const result = await window.electronAPI.arduino.libExamplesWithPaths(filter || '');
        const examples = result.success && result.data ? result.data : [];
        if (examples.length === 0) {
            listEl.innerHTML = '<div class="lib-msg">No examples found. Install libraries from Library Manager, then load again.</div>';
            return;
        }
        listEl.innerHTML = examples.map(ex => {
            const label = ex.library ? `${escapeHtml(ex.library)} → ${escapeHtml(ex.name)}` : escapeHtml(ex.name);
            return `<div class="example-item" data-path="${escapeHtml(ex.path)}" title="${escapeHtml(ex.path)}">
                <span class="example-label">${label}</span>
            </div>`;
        }).join('');
        listEl.querySelectorAll('.example-item').forEach(row => {
            row.addEventListener('click', () => {
                openExampleAtPath(row.dataset.path);
                hideExamplesDropdown();
            });
        });
    } catch (e) {
        listEl.innerHTML = `<div class="lib-msg error">${escapeHtml(e.message)}</div>`;
    }
}

function setupDebugPanel() {
    const startBtn = document.getElementById('debugStartBtn');
    const configBtn = document.getElementById('debugConfigBtn');
    startBtn?.addEventListener('click', () => {
        logToConsole('Debug: start debugging (configure launch.json for your board)', 'info');
    });
    configBtn?.addEventListener('click', () => {
        logToConsole('Debug configuration: add launch.json to your sketch folder for board-specific debugging', 'info');
    });
}

function updateDebugPanel() {
    const labelEl = document.getElementById('debugBoardLabel');
    if (!labelEl) return;
    const boardFQBN = document.getElementById('boardSelectSidebar')?.value;
    const boardName = state.boards?.find(b => b.fqbn === boardFQBN)?.name;
    labelEl.textContent = boardName ? (boardName.length > 18 ? boardName.slice(0, 15) + '...' : boardName) : 'No board selected';
}

function setupSearchPanel() {
    const input = document.getElementById('searchInput');
    const btn = document.getElementById('searchBtn');
    const resultsEl = document.getElementById('searchResults');
    btn?.addEventListener('click', () => runSearchInSketch(input?.value, resultsEl));
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSearchInSketch(input.value, resultsEl);
    });
}

function runSearchInSketch(query, resultsEl) {
    if (!state.editor || !query || !resultsEl) return;
    const code = state.editor.getValue();
    const lines = code.split('\n');
    const q = query.trim().toLowerCase();
    const hits = [];
    lines.forEach((line, i) => {
        if (line.toLowerCase().includes(q)) hits.push({ line: i + 1, text: line.trim() });
    });
    if (hits.length === 0) {
        resultsEl.innerHTML = '<div class="lib-msg">No matches.</div>';
        return;
    }
    resultsEl.innerHTML = hits.slice(0, 50).map(h =>
        `<div class="search-result-item" data-line="${h.line}"><span class="search-result-line">${h.line}</span> ${escapeHtml(h.text.slice(0, 80))}${h.text.length > 80 ? '…' : ''}</div>`
    ).join('');
    resultsEl.querySelectorAll('.search-result-item').forEach(row => {
        row.addEventListener('click', () => {
            const line = parseInt(row.dataset.line, 10);
            if (state.editor && !isNaN(line)) state.editor.setCursor(line - 1, 0);
        });
    });
}

async function openExampleAtPath(exampleFolderPath) {
    if (!exampleFolderPath) return;
    try {
        const res = await window.electronAPI.folder.list(exampleFolderPath);
        if (!res.success || !res.entries || res.entries.length === 0) {
            logToConsole('Example folder empty or not readable', 'error');
            return;
        }
        const inoFile = res.entries.find(e => !e.isDirectory && e.name.toLowerCase().endsWith('.ino'));
        if (!inoFile) {
            logToConsole('No .ino file found in example', 'error');
            return;
        }
        state.folderRoot = exampleFolderPath;
        state.expandedDirs.clear();
        const label = document.getElementById('folderLabel');
        const name = exampleFolderPath.split(/[/\\]/).pop() || 'Example';
        if (label) label.innerHTML = `<span class="folder-icon">📁</span><span>${escapeHtml(name)}</span>`;
        await renderFileTree(exampleFolderPath);
        const fileResult = await window.electronAPI.file.read(inoFile.path);
        const content = fileResult.success ? fileResult.content : '';
        showEditor();
        addOrFocusFile(inoFile.path, content, inoFile.name);
        switchToTab(state.openFiles.length - 1);
        saveSession();
        logToConsole(`Opened example: ${inoFile.name}`, 'success');
    } catch (e) {
        logToConsole(`Failed to open example: ${e.message}`, 'error');
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
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
        if (listEl) listEl.innerHTML = `<div class="lib-msg error">${escapeHtml(e.message || 'Search failed')}</div>`;
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

        // Escape all user-controlled strings to prevent XSS
        const safeName = escapeHtml(name);
        const safeAuthor = escapeHtml(author);
        const safeSentence = escapeHtml(sentence);
        const safeVer = escapeHtml(ver);

        let verOpts = versions.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
        if (!verOpts && ver) verOpts = `<option value="${safeVer}">${safeVer}</option>`;

        const installBtn = isInstalled
            ? `<span class="lib-installed">Installed${lib.version ? ` (${escapeHtml(lib.version)})` : ''}</span>`
            : (verOpts
                ? `<select class="lib-version">${verOpts}</select><button class="lib-install-btn" data-name="${safeName}">Install</button>`
                : '<span class="lib-msg">No version</span>');

        card.innerHTML = `
            <div class="lib-name">${safeName}</div>
            <div class="lib-meta">${safeAuthor}</div>
            <div class="lib-sentence">${safeSentence}</div>
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

    // Find the scrollable content area (or create it if it doesn't exist)
    let contentArea = outputEl.querySelector('.serial-output-content');
    if (!contentArea) {
        contentArea = document.createElement('div');
        contentArea.className = 'serial-output-content';
        outputEl.appendChild(contentArea);
    }

    const time = new Date(timestamp).toLocaleTimeString();
    const prefix = type === 'sent' ? '[TX]' : type === 'error' ? '[ERR]' : type === 'info' ? '[INFO]' : '[RX]';
    const className = type === 'error' ? 'error' : type === 'sent' ? 'sent' : type === 'info' ? 'info' : '';

    const line = document.createElement('div');
    line.className = `serial-line ${className}`;
    line.textContent = `[${time}] ${prefix} ${data}`;
    contentArea.appendChild(line);
    contentArea.scrollTop = contentArea.scrollHeight;
}

// ============================================
// Context Awareness Setup
// ============================================
function setupContextAwareness() {
    // Track active file changes
    const observer = new MutationObserver(() => {
        updateAIContext();
    });
    const editorWrapper = document.getElementById('editorWrapper');
    if (editorWrapper) {
        observer.observe(editorWrapper, { childList: true, subtree: true });
    }
}

function updateAIContext() {
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
        window.electronAPI.ai.updateContext(context).catch(() => { });
    }
}

// ============================================
// AI Panel Overlay (Top-Right) — Enhanced
// ============================================
function setupAIPanelOverlay() {
    const aiTab = document.getElementById('aiAgentTab');
    const aiPanel = document.getElementById('aiPanel');
    const aiMinBtn = document.getElementById('aiMinimizeBtn');
    const aiCloseBtn = document.getElementById('aiCloseBtn');

    if (aiTab) {
        aiTab.addEventListener('click', () => toggleAIPanel());
    }

    // Clicking the overlay background (outside inner) closes
    if (aiPanel) {
        aiPanel.addEventListener('click', (e) => {
            if (e.target === aiPanel) toggleAIPanel();
        });
    }

    // Minimize button: collapse to just the header
    if (aiMinBtn) {
        aiMinBtn.addEventListener('click', () => {
            state.aiPanelMinimized = !state.aiPanelMinimized;
            const panel = document.getElementById('aiPanel');
            if (panel) {
                panel.classList.toggle('minimized', state.aiPanelMinimized);
            }
            saveAIPanelState();
        });
    }

    // Close button: fully close the panel
    if (aiCloseBtn) {
        aiCloseBtn.addEventListener('click', () => {
            if (state.aiPanelOpen) toggleAIPanel();
        });
    }
}

// ============================================
// AI Panel Resize (drag left edge)
// ============================================
function setupAIPanelResize() {
    const handle = document.getElementById('aiResizeHandle');
    const panel = document.getElementById('aiPanel');
    if (!handle || !panel) return;

    let startX = 0;
    let startWidth = 0;
    let dragging = false;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startWidth = panel.getBoundingClientRect().width;
        handle.classList.add('dragging');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';

        // PERF: Kill the CSS transition during drag so it's instantaneous —
        // the animation was fighting every mousemove update causing lag.
        panel.style.transition = 'none';

        const onMouseMove = (ev) => {
            if (!dragging) return;
            const delta = startX - ev.clientX;
            const newWidth = Math.max(260, Math.min(window.innerWidth * 0.6, startWidth + delta));
            state.aiPanelWidth = newWidth;
            panel.style.setProperty('--ai-panel-current-width', `${newWidth}px`);
        };

        const onMouseUp = () => {
            dragging = false;
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Restore the snappy open/close transition after drag ends
            panel.style.transition = 'width 0.2s ease';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            saveAIPanelState();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
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
            panel.classList.add('open');
            // Restore saved width
            if (state.aiPanelWidth) {
                panel.style.setProperty('--ai-panel-current-width', `${state.aiPanelWidth}px`);
            }
            // Restore minimized state
            panel.classList.toggle('minimized', state.aiPanelMinimized);
            if (tab) tab.classList.add('active');
        } else {
            panel.classList.remove('open');
            panel.classList.remove('minimized');
            if (tab) tab.classList.remove('active');
        }
        saveAIPanelState();
    }
}

// Persist AI panel state
const AI_PANEL_STATE_KEY = 'arduino-ide-ai-panel-state';

function saveAIPanelState() {
    try {
        localStorage.setItem(AI_PANEL_STATE_KEY, JSON.stringify({
            open: state.aiPanelOpen,
            minimized: state.aiPanelMinimized,
            width: state.aiPanelWidth
        }));
    } catch (e) { /* ignore */ }
}

function restoreAIPanelState() {
    try {
        const raw = localStorage.getItem(AI_PANEL_STATE_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.width && typeof s.width === 'number') {
            state.aiPanelWidth = s.width;
        }
        if (s.minimized) {
            state.aiPanelMinimized = true;
        }
        // Restore panel open state
        if (s.open) {
            // Open it silently without toggling
            const panel = document.getElementById('aiPanel');
            const tab = document.getElementById('aiAgentTab');
            if (panel) {
                state.aiPanelOpen = true;
                panel.classList.add('open');
                panel.style.setProperty('--ai-panel-current-width', `${state.aiPanelWidth}px`);
                panel.classList.toggle('minimized', state.aiPanelMinimized);
                if (tab) tab.classList.add('active');
            }
        }
    } catch (e) { /* ignore */ }
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
            // Switch to Serial Plotter tab in output panel
            document.querySelector('.output-tab[data-tab="plotter"]')?.click();
            // Also open serial panel in sidebar if needed
            if (state.sidebarCollapsed) toggleSidebar();
            switchPanel('serial');
        });
    }
}

// ============================================
// Serial Plotter Engine
// ============================================
const PLOTTER_COLORS = [
    '#00D4AA', // Teal (primary accent)
    '#FF5252', // Red
    '#FFB300', // Amber
    '#00B8D4', // Cyan
    '#B388FF', // Purple
    '#00E676', // Green
    '#FF6E40', // Deep Orange
    '#40C4FF'  // Light Blue
];

function feedPlotterData(rawData) {
    if (state.plotter.paused) return;

    // Parse numeric values from the serial line
    // Supports: single number, comma-separated, tab-separated, space-separated
    const line = String(rawData).trim();
    if (!line) return;

    // Split by common delimiters
    const parts = line.split(/[,\t ]+/);
    const values = [];

    for (const part of parts) {
        const num = parseFloat(part);
        if (!isNaN(num) && isFinite(num)) {
            values.push(num);
        }
    }

    if (values.length === 0) return;

    // Update channel count
    state.plotter.channelCount = Math.max(state.plotter.channelCount, values.length);

    // Add data point
    state.plotter.data.push({
        timestamp: Date.now(),
        values: values
    });

    // Trim old data
    while (state.plotter.data.length > state.plotter.maxPoints) {
        state.plotter.data.shift();
    }

    // Update UI counters
    const channelEl = document.getElementById('plotterChannelCount');
    const pointEl = document.getElementById('plotterPointCount');
    if (channelEl) channelEl.textContent = state.plotter.channelCount;
    if (pointEl) pointEl.textContent = state.plotter.data.length;
}

function setupSerialPlotter() {
    const pauseBtn = document.getElementById('plotterPauseBtn');
    const clearBtn = document.getElementById('plotterClearBtn');

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            state.plotter.paused = !state.plotter.paused;
            pauseBtn.classList.toggle('active', state.plotter.paused);
            pauseBtn.textContent = state.plotter.paused ? '▶' : '⏸';
            pauseBtn.title = state.plotter.paused ? 'Resume' : 'Pause';
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            state.plotter.data = [];
            state.plotter.channelCount = 0;
            const channelEl = document.getElementById('plotterChannelCount');
            const pointEl = document.getElementById('plotterPointCount');
            if (channelEl) channelEl.textContent = '0';
            if (pointEl) pointEl.textContent = '0';
        });
    }
}

function startPlotterRendering() {
    if (state.plotter.running) return;
    state.plotter.running = true;
    renderPlotterFrame();
}

function stopPlotterRendering() {
    state.plotter.running = false;
    if (state.plotter.animFrameId) {
        cancelAnimationFrame(state.plotter.animFrameId);
        state.plotter.animFrameId = null;
    }
}

function renderPlotterFrame() {
    if (!state.plotter.running) return;

    const canvas = document.getElementById('plotterCanvas');
    if (!canvas) {
        state.plotter.running = false;
        return;
    }

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();

    // Scale canvas to actual pixel size (HiDPI support)
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height - 28; // subtract toolbar height

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.scale(dpr, dpr);
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Clear canvas
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = isDark ? '#0A0A14' : '#F5F5FA';
    ctx.fillRect(0, 0, w, h);

    const data = state.plotter.data;
    const channels = state.plotter.channelCount;

    if (data.length < 2 || channels === 0) {
        // Draw empty state
        ctx.fillStyle = isDark ? '#4A4A6A' : '#9898B0';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for serial data...', w / 2, h / 2);
        ctx.font = '10px monospace';
        ctx.fillText('Send numeric values (e.g. "100" or "100,200,300")', w / 2, h / 2 + 18);
        state.plotter.animFrameId = requestAnimationFrame(renderPlotterFrame);
        return;
    }

    // Calculate Y range
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const point of data) {
        for (const v of point.values) {
            if (v < yMin) yMin = v;
            if (v > yMax) yMax = v;
        }
    }

    // Add padding to Y range
    const yRange = yMax - yMin || 1;
    yMin -= yRange * 0.1;
    yMax += yRange * 0.1;

    // Layout
    const pad = { left: 50, right: 16, top: 10, bottom: 20 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Grid lines
    ctx.strokeStyle = isDark ? '#1A1A2E' : '#E0E0E8';
    ctx.lineWidth = 1;

    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
        const y = pad.top + (plotH * i) / ySteps;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();

        // Y axis labels
        const val = yMax - ((yMax - yMin) * i) / ySteps;
        ctx.fillStyle = isDark ? '#6A6A8A' : '#8888A0';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(val >= 100 || val <= -100 ? 0 : 1), pad.left - 6, y + 3);
    }

    // X axis labels (timestamps)
    const xSteps = Math.min(5, data.length - 1);
    for (let i = 0; i <= xSteps; i++) {
        const x = pad.left + (plotW * i) / xSteps;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, h - pad.bottom);
        ctx.stroke();
    }

    // Draw data lines for each channel
    for (let ch = 0; ch < channels; ch++) {
        ctx.strokeStyle = PLOTTER_COLORS[ch % PLOTTER_COLORS.length];
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        let firstPoint = true;
        for (let i = 0; i < data.length; i++) {
            const val = data[i].values[ch];
            if (val === undefined) continue;

            const x = pad.left + (plotW * i) / (data.length - 1);
            const y = pad.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }

    // Draw channel legend
    if (channels > 0) {
        const legendX = pad.left + 8;
        let legendY = pad.top + 14;
        ctx.font = '10px monospace';
        for (let ch = 0; ch < channels; ch++) {
            const color = PLOTTER_COLORS[ch % PLOTTER_COLORS.length];
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY - 8, 10, 10);
            ctx.fillStyle = isDark ? '#C0C0D0' : '#3A3A52';
            const lastVal = data[data.length - 1]?.values[ch];
            const label = `Ch${ch + 1}: ${lastVal !== undefined ? lastVal.toFixed(2) : '--'}`;
            ctx.textAlign = 'left';
            ctx.fillText(label, legendX + 14, legendY);
            legendY += 14;
        }
    }

    state.plotter.animFrameId = requestAnimationFrame(renderPlotterFrame);
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
            if (window.electronAPI?.ui?.updateBoard) {
                window.electronAPI.ui.updateBoard(session.boardFQBN);
            }
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
            if (window.electronAPI?.ui?.updatePort) {
                window.electronAPI.ui.updatePort(session.port);
            }
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

async function restoreAIPreferences() {
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
            }
            // Actually initialize the provider on the backend using the saved API key
            try {
                const result = await window.electronAPI.ai.setModel(prefs.modelId);
                if (result.success) {
                    state.aiProviderConfigured = true;
                    updateAIStatus('Ready');
                } else if (result.needsKey) {
                    state.aiProviderConfigured = false;
                    updateAIStatus('API key needed — click the user icon to add one');
                } else {
                    state.aiProviderConfigured = false;
                    updateAIStatus(result.error || 'Could not restore model');
                }
            } catch (err) {
                state.aiProviderConfigured = false;
                updateAIStatus('Could not restore model');
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

// ============================================
// Code Snapshot & Revert System
// ============================================
const SNAPSHOTS_KEY = 'impulse-code-snapshots';
const MAX_SNAPSHOTS = 50;

function takeCodeSnapshot(prompt) {
    if (!state.editor) return null;
    const code = state.editor.getValue();
    const filePath = state.currentSketch || state.currentFile || null;

    const snapshot = {
        id: 'snap-' + Date.now(),
        timestamp: new Date().toISOString(),
        prompt,
        code,
        filePath
    };

    try {
        const existing = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
        existing.unshift(snapshot); // newest first
        if (existing.length > MAX_SNAPSHOTS) existing.splice(MAX_SNAPSHOTS);
        localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(existing));
    } catch (e) {
        console.warn('[Snapshots] Save failed:', e);
    }

    return snapshot.id;
}

function revertToSnapshot(id) {
    if (!id || !state.editor) return;

    try {
        const existing = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
        const snap = existing.find(s => s.id === id);
        if (!snap) {
            logToConsole('Snapshot not found — it may have been cleared.', 'warning');
            return;
        }

        // Restore code into editor
        state.editor.setValue(snap.code);

        // Persist to disk if we have a file path
        if (snap.filePath && window.electronAPI?.file?.save) {
            window.electronAPI.file.save(snap.filePath, snap.code)
                .catch(e => console.warn('[Revert] File save failed:', e));
        }

        const timeStr = new Date(snap.timestamp).toLocaleTimeString();
        logToConsole(`✓ Reverted to snapshot from ${timeStr}`, 'info');
        addAIMessage('system', `Code reverted to state before: "${snap.prompt.slice(0, 60)}${snap.prompt.length > 60 ? '…' : ''}"`);
    } catch (e) {
        console.warn('[Revert] Failed:', e);
        logToConsole('Revert failed — see console for details.', 'error');
    }
}

// Wire up revert button clicks via event delegation (handles dynamically added buttons)
function setupRevertButtonHandler() {
    const container = document.getElementById('aiMessages');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.msg-revert-btn');
        if (!btn) return;
        const snapId = btn.dataset.snapshotId;
        if (snapId) revertToSnapshot(snapId);
    });
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

    // --- Snapshot current code BEFORE AI edits it ---
    const snapId = takeCodeSnapshot(message);

    addAIMessage('user', message, false, false, snapId);
    input.value = '';

    const thinkingId = addAIMessage('assistant', '<span class="shimmer-text">Thinking…</span>', true, true);

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

function addAIMessage(role, content, isTemporary = false, isRawHtml = false, snapshotId = null) {
    const container = document.getElementById('aiMessages');
    if (!container) return null;

    const welcome = container.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${role}`;
    if (isTemporary) {
        messageDiv.id = 'temp-message-' + Date.now();
        if (isRawHtml) messageDiv.classList.add('thinking-shimmer');
    }

    messageDiv.innerHTML = isRawHtml ? content : formatAIContent(content);

    // Add revert button to user messages that have a snapshot
    if (role === 'user' && snapshotId) {
        const revertBtn = document.createElement('button');
        revertBtn.className = 'msg-revert-btn';
        revertBtn.dataset.snapshotId = snapshotId;
        revertBtn.title = 'Revert code to state before this prompt';
        revertBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Revert`;
        messageDiv.appendChild(revertBtn);
    }

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
    // Basic markdown formatting
    let formatted = content
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Code blocks with language and insert button
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'TEXT';
        // Escape HTML within code block to prevent rendering
        const escapedCode = code.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        return `<div class="code-block-wrapper">
            <div class="code-block-header">
                <span class="code-lang">${language}</span>
                <button class="code-insert-btn" title="Insert at cursor">Insert</button>
            </div>
            <pre><code class="language-${language}">${escapedCode}</code></pre>
        </div>`;
    });

    return formatted.replace(/\n/g, '<br>');
}

function setupCodeBlockActions() {
    const aiMessages = document.getElementById('aiMessages');
    if (!aiMessages) return;

    aiMessages.addEventListener('click', (e) => {
        if (e.target.classList.contains('code-insert-btn')) {
            const wrapper = e.target.closest('.code-block-wrapper');
            if (wrapper) {
                const codeEl = wrapper.querySelector('code');
                if (codeEl) {
                    // Unescape HTML entities before inserting
                    const temp = document.createElement('textarea');
                    temp.innerHTML = codeEl.innerHTML.replace(/<br>/g, '\n');
                    const code = temp.value;
                    insertCodeAtCursor(code);
                }
            }
        }
    });
}

function insertCodeAtCursor(code) {
    if (state.editor) {
        state.editor.replaceSelection(code);
        state.editor.focus();
    } else {
        // Fallback or show error
        console.warn('No active editor to insert code');
    }
}

function setupResizers() {
    // Sidebar Resize
    const sidebarResizer = document.getElementById('sidebarResizer');
    const sidebar = document.querySelector('.sidebar');

    if (sidebarResizer && sidebar) {
        let isResizing = false;

        sidebarResizer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click
            e.preventDefault(); // Prevent text selection

            isResizing = true;
            document.body.classList.add('resizing-col');
            sidebarResizer.classList.add('active');

            const startX = e.clientX;
            const startWidth = sidebar.getBoundingClientRect().width;

            const COLLAPSE_THRESHOLD = 80;

            const onMouseMove = (ev) => {
                if (!isResizing) return;
                const newWidth = startWidth + (ev.clientX - startX);
                if (newWidth < COLLAPSE_THRESHOLD) {
                    // Auto-collapse when dragged past threshold
                    state.sidebarCollapsed = true;
                    sidebar.classList.add('collapsed');
                    sidebar.style.width = '';
                    sidebar.style.flexBasis = '';
                } else if (newWidth <= 600) {
                    // Min 150px when expanding, but allow dragging down to collapse
                    const width = Math.max(150, newWidth);
                    sidebar.classList.remove('collapsed');
                    state.sidebarCollapsed = false;
                    sidebar.style.width = `${width}px`;
                    sidebar.style.flexBasis = `${width}px`;
                }
            };

            const onMouseUp = () => {
                isResizing = false;
                document.body.classList.remove('resizing-col');
                sidebarResizer.classList.remove('active');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (state.editor) state.editor.refresh();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // Output Panel Resize
    const outputResizer = document.getElementById('outputResizer');
    const outputPanel = document.getElementById('outputPanel');

    if (outputResizer && outputPanel) {
        let isResizing = false;

        outputResizer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();

            isResizing = true;
            document.body.classList.add('resizing-row');
            outputResizer.classList.add('active');

            const startY = e.clientY;
            // Get current COMPUTED height if style.height is not set
            const startHeight = outputPanel.getBoundingClientRect().height;

            const onMouseMove = (ev) => {
                if (!isResizing) return;
                // dragging up (smaller Y) increases height
                const delta = startY - ev.clientY;
                const newHeight = startHeight + delta;

                // Min 28px (header only), Max (window height - 200)
                if (newHeight >= 28 && newHeight <= (window.innerHeight - 200)) {
                    outputPanel.style.height = `${newHeight}px`;
                    outputPanel.style.flexBasis = `${newHeight}px`;
                }
            };

            const onMouseUp = () => {
                isResizing = false;
                document.body.classList.remove('resizing-row');
                outputResizer.classList.remove('active');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (state.editor) state.editor.refresh();
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
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

    // Split message by newlines to handle multiple errors
    const lines = message.split('\n');

    lines.forEach(msgLine => {
        if (!msgLine.trim()) return;

        const problemDiv = document.createElement('div');
        problemDiv.className = 'problem-entry';

        // Parse GCC/Arduino error format: filename:line:col: type: message
        // Regex: (path):(line):(col): (type): (message)
        const match = msgLine.match(/^(.+?):(\d+):(\d+):\s*(\w+):\s*(.*)$/);

        if (match) {
            const [_, file, line, col, type, text] = match;

            // Location Link
            const locSpan = document.createElement('span');
            locSpan.className = 'problem-location';
            locSpan.textContent = `${file.split(/[\\/]/).pop()}:${line}:${col}`;
            locSpan.title = `Jump to ${file}:${line}`;
            locSpan.onclick = () => {
                if (state.editor) {
                    // CodeMirror is 0-indexed for lines and cols
                    const lineNum = parseInt(line) - 1;
                    const colNum = parseInt(col) - 1;
                    state.editor.setCursor({ line: lineNum, ch: colNum });
                    state.editor.focus();

                    // Highlight line temporarily
                    state.editor.addLineClass(lineNum, 'background', 'line-error-flash');
                    setTimeout(() => {
                        state.editor.removeLineClass(lineNum, 'background', 'line-error-flash');
                    }, 1500);
                }
            };

            // Type Label (Error/Warning)
            const typeSpan = document.createElement('span');
            typeSpan.className = `problem-type ${type.toLowerCase()}`;
            typeSpan.textContent = type;

            // Message
            const msgSpan = document.createElement('span');
            msgSpan.className = 'problem-message';
            msgSpan.textContent = text;

            problemDiv.appendChild(locSpan);
            problemDiv.appendChild(typeSpan);
            problemDiv.appendChild(msgSpan);
        } else {
            // Unparsed line (e.g. "In function 'main':")
            problemDiv.className = 'problem-line';
            problemDiv.textContent = msgLine;
        }

        problemsEl.appendChild(problemDiv);
    });

    // Auto-switch to Problems tab if errors exist
    if (lines.length > 0) {
        document.querySelector('.output-tab[data-tab="problems"]')?.click();
    }
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
                if (window.electronAPI?.ui?.updateBoard) {
                    window.electronAPI.ui.updateBoard(boardFQBN);
                }
            }

            if (selectedPort) {
                const port = selectedPort.dataset.port;
                document.getElementById('portSelectSidebar').value = port;
                state.selectedPort = port;
                state.context.selectedPort = port;
                const display = document.getElementById('boardPortDisplay');
                const currentText = display.textContent;
                updateBoardPortDisplay(currentText.split(' on ')[0], port);
                if (window.electronAPI?.ui?.updatePort) {
                    window.electronAPI.ui.updatePort(port);
                }
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
