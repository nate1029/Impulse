# Impulse Agent — Implementation Plan

> Goal: turn Impulse from a single-file AI chat assistant into a full **Arduino-first agentic IDE**
> (Claude-Code / Antigravity class) while keeping the embedded focus as the differentiator.
>
> This document is written so a implementer (or a cheaper model) can execute it **mechanically**.
> Phase 1 is fully spec'd with drop-in code. Phases 2–6 lock the design decisions; their code is
> generated when we reach them.

---

## 0. Current state (verified) — what exists vs. what's missing

| Capability | Backend | Exposed to AI | UI |
|---|---|---|---|
| File read/write/list | ✅ `src/main/ipc/fileHandlers.js` | ❌ **no file tools** | ✅ tree only |
| Terminal (node-pty) | ✅ fully wired IPC in `main.js` (`terminal:*`) | ❌ | ❌ **no panel** |
| Agentic tool loop | ✅ `agent.js` `processQuery` (10 iters) | — | ✅ chat |
| File watching | ✅ `chokidar` in deps | ❌ | ❌ |
| Compaction / token mgmt | ✅ (just built) | ✅ | ✅ |
| Path security | ✅ `src/main/utils/pathValidator.js` (`approveDirectory`/`validatePath`) | — | — |

**The core problem:** the AI's 25 tools (`toolSchema.js`) only touch the *active editor buffer*, Arduino,
and serial. There is **no `read_file` / `write_file` / `list_directory` / `search_files`**. The agent
cannot see or edit any file except the one on screen. Fixing that is Phase 1 and unlocks everything else.

**Key integration facts (already confirmed in code):**
- Workspace folder is opened in renderer `openFolder()` (`renderer.js:2003`), stored as `state.folderRoot`.
  The dialog handler `dialog:open-folder` already calls `approveDirectory(folderPath)`.
- `main.js` has a global `uiState` object (`main.js:30`) and sets `toolExecutor.setUICallbacks({...})`
  (`main.js:266`). Add new callbacks here.
- `AIAgent` constructor (`agent.js:14`): `constructor(arduinoService, serialMonitor, errorMemory, config = {})`
  and builds `new ToolExecutor(arduinoService, serialMonitor, errorMemory, this.memory)`.
- `ToolExecutor` constructor (`toolExecutor.js:9`): `constructor(arduinoService, serialMonitor, errorMemory, aiMemory)`.
- Tool dispatch is a `switch (toolCall.name)` in `toolExecutor.execute()` (`toolExecutor.js:53`).
- Renderer↔main IPC goes through `electronAPI` in `preload.js`; Zod schemas in `ipc/schemas.js`.

---

## PHASE 1 — Codebase Agency (foundation) ✅ fully spec'd

Give the agent safe, workspace-scoped filesystem tools and enough project context to use them.

### 1.1 NEW FILE: `src/main/services/workspace.js`

Confines all access to the currently open folder (stricter than `pathValidator`'s multi-root model —
this prevents the agent from wandering outside the project). Drop in verbatim:

```js
/**
 * Workspace Service
 * Filesystem access confined to the currently open project folder (the "root").
 * All agent file tools go through here. Paths may be workspace-relative or absolute;
 * either way the resolved path MUST stay inside the root or the call is rejected.
 */
const fs = require('fs').promises;
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', '.vscode', '.pio', '.pioenvs',
  '__pycache__', '.cache', '.next', 'out', 'coverage'
]);
// Extensions we treat as searchable/readable text (Arduino-first + common config).
const TEXT_EXTS = new Set([
  '.ino', '.h', '.hpp', '.cpp', '.c', '.cc', '.cxx', '.txt', '.md', '.json',
  '.csv', '.yaml', '.yml', '.ini', '.cfg', '.properties', '.xml', '.html',
  '.css', '.js', '.ts', '.py', '.s', '.asm', '.ld'
]);
const MAX_FILE_BYTES = 512 * 1024;   // 512 KB read cap
const MAX_TREE_ENTRIES = 500;
const MAX_SEARCH_RESULTS = 100;

class WorkspaceService {
  constructor() { this.root = null; }

  setRoot(dir) { this.root = dir ? path.resolve(dir) : null; return this.root; }
  getRoot() { return this.root; }
  hasRoot() { return !!this.root; }

  /** Resolve a path against root and guarantee it stays inside root. */
  _resolve(p) {
    if (!this.root) throw new Error('No workspace folder is open. Ask the user to open a folder.');
    if (!p || typeof p !== 'string') throw new Error('Path is required');
    if (p.includes('\0')) throw new Error('Invalid path (null byte)');
    const abs = path.isAbsolute(p) ? path.resolve(p) : path.resolve(this.root, p);
    const rel = path.relative(this.root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Access denied: "${p}" is outside the workspace.`);
    }
    return abs;
  }

  /** Workspace-relative, forward-slash path for display/return. */
  _rel(abs) { return path.relative(this.root, abs).split(path.sep).join('/') || '.'; }

  async readFile(p) {
    const abs = this._resolve(p);
    const st = await fs.stat(abs);
    if (st.isDirectory()) throw new Error('Path is a directory, not a file.');
    if (st.size > MAX_FILE_BYTES) throw new Error(`File too large (${st.size} bytes, cap ${MAX_FILE_BYTES}).`);
    const content = await fs.readFile(abs, 'utf8');
    return { path: this._rel(abs), absPath: abs, content, bytes: st.size };
  }

  async writeFile(p, content) {
    const abs = this._resolve(p);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content ?? '', 'utf8');
    return { path: this._rel(abs), absPath: abs, bytes: Buffer.byteLength(content ?? '', 'utf8') };
  }

  async createFile(p, content) {
    const abs = this._resolve(p);
    let exists = false;
    try { await fs.access(abs); exists = true; } catch (_) { /* ok */ }
    if (exists) throw new Error('File already exists. Use write_file to overwrite.');
    return this.writeFile(p, content ?? '');
  }

  async listDirectory(p = '.') {
    const abs = this._resolve(p);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    return entries
      .filter(e => !(e.isDirectory() && IGNORED_DIRS.has(e.name)))
      .map(e => ({
        name: e.name,
        path: this._rel(path.join(abs, e.name)),
        isDirectory: e.isDirectory()
      }))
      .sort((a, b) => (a.isDirectory !== b.isDirectory)
        ? (a.isDirectory ? -1 : 1)
        : a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }

  /** Compact indented tree string, depth-limited, capped. Good for context injection. */
  async getTree(maxDepth = 3) {
    if (!this.root) throw new Error('No workspace folder is open.');
    const lines = [];
    let count = 0;
    const walk = async (dir, depth, prefix) => {
      if (depth > maxDepth || count >= MAX_TREE_ENTRIES) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      entries = entries
        .filter(e => !e.name.startsWith('.') && !(e.isDirectory() && IGNORED_DIRS.has(e.name)))
        .sort((a, b) => (a.isDirectory !== b.isDirectory)
          ? (a.isDirectory ? -1 : 1)
          : a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      for (const e of entries) {
        if (count >= MAX_TREE_ENTRIES) { lines.push(prefix + '… (truncated)'); return; }
        count++;
        lines.push(prefix + e.name + (e.isDirectory() ? '/' : ''));
        if (e.isDirectory()) await walk(path.join(dir, e.name), depth + 1, prefix + '  ');
      }
    };
    await walk(this.root, 1, '');
    return lines.join('\n');
  }

  /** grep-style search across text files. Returns [{path, line, text}]. */
  async searchFiles(query, opts = {}) {
    if (!this.root) throw new Error('No workspace folder is open.');
    if (!query) throw new Error('Search query required');
    const isRegex = !!opts.isRegex;
    const maxResults = opts.maxResults || MAX_SEARCH_RESULTS;
    let re;
    try {
      const src = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(src, 'g');
    } catch { throw new Error('Invalid regular expression'); }

    const results = [];
    const walk = async (dir) => {
      if (results.length >= maxResults) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (results.length >= maxResults) return;
        if (e.name.startsWith('.')) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (IGNORED_DIRS.has(e.name)) continue;
          await walk(abs);
        } else {
          if (!TEXT_EXTS.has(path.extname(e.name).toLowerCase())) continue;
          let content;
          try {
            const st = await fs.stat(abs);
            if (st.size > MAX_FILE_BYTES) continue;
            content = await fs.readFile(abs, 'utf8');
          } catch { continue; }
          const linesArr = content.split('\n');
          for (let i = 0; i < linesArr.length; i++) {
            re.lastIndex = 0;
            if (re.test(linesArr[i])) {
              results.push({ path: this._rel(abs), line: i + 1, text: linesArr[i].slice(0, 200).trim() });
              if (results.length >= maxResults) return;
            }
          }
        }
      }
    };
    await walk(this.root);
    return results;
  }
}

module.exports = WorkspaceService;
```

### 1.2 EDIT `src/main/services/ai/tools/toolSchema.js`

Add these 6 entries inside the `TOOL_SCHEMA` object (e.g. right after `GET_CURRENT_STATE`, before `UPDATE_PLAYGROUND`). Paths are workspace-relative.

```js
  // ---- Workspace / filesystem (whole project) ----
  READ_FILE: {
    name: 'read_file',
    description: 'Read any text file in the open project by workspace-relative path (e.g. "src/main.ino"). Use this to inspect files other than the one on screen before editing.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Workspace-relative file path' } },
      required: ['path']
    }
  },
  WRITE_FILE: {
    name: 'write_file',
    description: 'Create or overwrite a file in the project with the given content. Prefer editing the active editor via edit_code for the open sketch; use write_file for OTHER files. Always read_file first if unsure of current contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative file path' },
        content: { type: 'string', description: 'Full new file content' }
      },
      required: ['path', 'content']
    }
  },
  CREATE_FILE: {
    name: 'create_file',
    description: 'Create a NEW file. Fails if the file already exists (use write_file to overwrite).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative file path' },
        content: { type: 'string', description: 'Initial file content' }
      },
      required: ['path']
    }
  },
  LIST_DIRECTORY: {
    name: 'list_directory',
    description: 'List files and subfolders of a directory in the project (default: project root).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Workspace-relative directory path. Omit for root.' } },
      required: []
    }
  },
  GET_PROJECT_TREE: {
    name: 'get_project_tree',
    description: 'Get a compact tree of the whole project structure. Use once at the start to orient yourself.',
    parameters: {
      type: 'object',
      properties: { maxDepth: { type: 'number', description: 'Max depth (default 3)' } },
      required: []
    }
  },
  SEARCH_FILES: {
    name: 'search_files',
    description: 'Search the text of all project files for a string or regex. Returns matching file paths, line numbers, and the matched line.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or regex to find' },
        isRegex: { type: 'boolean', description: 'Treat query as regex (default false)' }
      },
      required: ['query']
    }
  },
```

No change needed to `getAllTools()` (it returns `Object.values`). These 6 tools become available in `agent` mode automatically. They are NOT in `DEBUG_TOOL_NAMES`, so debug mode stays unchanged.

### 1.3 EDIT `src/main/services/ai/tools/toolExecutor.js`

**(a)** Constructor — accept `workspaceService`:

```js
// BEFORE
constructor(arduinoService, serialMonitor, errorMemory, aiMemory) {
  this.arduinoService = arduinoService;
  this.serialMonitor = serialMonitor;
  this.errorMemory = errorMemory;
  this.aiMemory = aiMemory;
// AFTER — add param + assignment
constructor(arduinoService, serialMonitor, errorMemory, aiMemory, workspaceService = null) {
  this.arduinoService = arduinoService;
  this.serialMonitor = serialMonitor;
  this.errorMemory = errorMemory;
  this.aiMemory = aiMemory;
  this.workspaceService = workspaceService;
```

**(b)** Dispatch — add cases in the `switch (toolCall.name)` (put near the editor cases):

```js
        case 'read_file':
          result = await this.executeReadFile(toolCall.arguments);
          break;
        case 'write_file':
          result = await this.executeWriteFile(toolCall.arguments);
          break;
        case 'create_file':
          result = await this.executeCreateFile(toolCall.arguments);
          break;
        case 'list_directory':
          result = await this.executeListDirectory(toolCall.arguments);
          break;
        case 'get_project_tree':
          result = await this.executeGetProjectTree(toolCall.arguments);
          break;
        case 'search_files':
          result = await this.executeSearchFiles(toolCall.arguments);
          break;
```

**(c)** Methods — add these (anywhere in the class body, e.g. after `executeSaveSketch`):

```js
  _ws() {
    if (!this.workspaceService || !this.workspaceService.hasRoot()) {
      throw new Error('No workspace folder is open. Ask the user to open a project folder first.');
    }
    return this.workspaceService;
  }

  async executeReadFile(args) {
    const { path: p } = args || {};
    const r = await this._ws().readFile(p);
    return { success: true, tool: 'read_file', path: r.path, content: r.content, bytes: r.bytes };
  }

  async executeWriteFile(args) {
    const { path: p, content } = args || {};
    const r = await this._ws().writeFile(p, content ?? '');
    // Notify the renderer so the tree refreshes and any open tab updates.
    if (this.uiCallbacks && this.uiCallbacks.onFileWritten) {
      try { await this.uiCallbacks.onFileWritten(r.path, r.absPath, content ?? ''); } catch (_) {}
    }
    return { success: true, tool: 'write_file', path: r.path, bytes: r.bytes };
  }

  async executeCreateFile(args) {
    const { path: p, content } = args || {};
    const r = await this._ws().createFile(p, content ?? '');
    if (this.uiCallbacks && this.uiCallbacks.onFileWritten) {
      try { await this.uiCallbacks.onFileWritten(r.path, r.absPath, content ?? ''); } catch (_) {}
    }
    return { success: true, tool: 'create_file', path: r.path, bytes: r.bytes };
  }

  async executeListDirectory(args) {
    const { path: p } = args || {};
    const entries = await this._ws().listDirectory(p || '.');
    return { success: true, tool: 'list_directory', entries };
  }

  async executeGetProjectTree(args) {
    const { maxDepth } = args || {};
    const tree = await this._ws().getTree(typeof maxDepth === 'number' ? maxDepth : 3);
    return { success: true, tool: 'get_project_tree', tree };
  }

  async executeSearchFiles(args) {
    const { query, isRegex } = args || {};
    const results = await this._ws().searchFiles(query, { isRegex: !!isRegex });
    return { success: true, tool: 'search_files', count: results.length, results };
  }
```

### 1.4 EDIT `src/main/services/ai/agent.js`

Pass `workspaceService` through:

```js
// Constructor signature (agent.js:14)
// BEFORE: constructor(arduinoService, serialMonitor, errorMemory, config = {}) {
// AFTER:
constructor(arduinoService, serialMonitor, errorMemory, config = {}, workspaceService = null) {
  ...
  // ToolExecutor construction (agent.js ~23) — add 5th arg:
  this.toolExecutor = new ToolExecutor(
    arduinoService,
    serialMonitor,
    errorMemory,
    this.memory,
    workspaceService
  );
  this.workspaceService = workspaceService;
```

### 1.5 EDIT `src/main/main.js`

**(a)** Require + instantiate before the agent (near `main.js:18` requires and `main.js:258` service setup):

```js
const WorkspaceService = require('./services/workspace'); // top with other requires
// ...
let workspaceService; // top-level, near `let terminalService;` (main.js:28)
// in app.whenReady, BEFORE `aiAgent = new AIAgent(...)`:
workspaceService = new WorkspaceService();
aiAgent = new AIAgent(arduinoService, serialMonitor, errorMemory, {}, workspaceService);
```

**(b)** Add `workspaceRoot: null` to `uiState` (main.js:30).

**(c)** Add an `onFileWritten` callback inside `setUICallbacks({...})` (main.js:266). Add this key:

```js
      onFileWritten: async (relPath, absPath, content) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('workspace:file-written', { path: relPath, absPath, content });
        }
      },
```

**(d)** Add an IPC handler to set the workspace root (near the terminal handlers, main.js ~373):

```js
  ipcMain.handle('workspace:set-root', (_event, root) => {
    if (typeof root === 'string' && root.trim()) {
      const resolved = workspaceService.setRoot(root);
      uiState.workspaceRoot = resolved;
      try { require('./utils/pathValidator').approveDirectory(resolved); } catch (_) {}
      return { success: true, root: resolved };
    }
    workspaceService.setRoot(null);
    uiState.workspaceRoot = null;
    return { success: true, root: null };
  });
```

### 1.6 EDIT `src/main/preload.js`

Add a `workspace` section to `electronAPI` (alongside `ai`, `file`, etc.):

```js
  workspace: {
    setRoot: (root) => ipcRenderer.invoke('workspace:set-root', root),
    onFileWritten: (cb) => ipcRenderer.on('workspace:file-written', (_e, data) => cb(data))
  },
```

### 1.7 EDIT `src/renderer/renderer.js`

**(a)** In `openFolder()` (renderer.js:2003), after `state.folderRoot = result.folderPath;`, tell main:

```js
    await window.electronAPI.workspace.setRoot(result.folderPath);
```

Also add the same line in the two other places `state.folderRoot` is set from a real folder:
- session restore (`renderer.js:3161` area, inside the restore block)
- example open (`renderer.js:1975` area)
Guard each with `if (window.electronAPI.workspace)`.

**(b)** Register a file-written listener once during init (near other `setup*Listeners`):

```js
function setupWorkspaceListeners() {
    if (!window.electronAPI.workspace) return;
    window.electronAPI.workspace.onFileWritten(({ path: relPath, absPath, content }) => {
        // If the written file is open in a tab, update its buffer (origin 'setValue'
        // so it is NOT marked dirty), refreshing the editor if it's the active tab.
        const idx = state.openFiles.findIndex(f => f.path === absPath || f.path === relPath);
        if (idx >= 0) {
            state.openFiles[idx].content = content;
            if (idx === state.activeTabIndex && state.editor) {
                const cur = state.editor.getCursor();
                state.editor.setValue(content); // origin defaults to 'setValue'
                try { state.editor.setCursor(cur); } catch (_) {}
            }
        }
        // Refresh the file tree so new files appear.
        if (state.folderRoot) { try { renderFileTree(state.folderRoot); } catch (_) {} }
        logToConsole(`AI wrote ${relPath}`, 'info');
    });
}
```

Call `setupWorkspaceListeners();` in the init sequence (where `setupSerialListeners()` etc. are called).

### 1.8 EDIT `src/main/services/ai/prompts/systemPrompt.js`

Add a short section to the agent-mode system prompt telling it the file tools exist and how to use them. Insert into the agent prompt text:

```
PROJECT FILES:
- You can read and edit ANY file in the open project, not just the on-screen editor.
- Tools: get_project_tree (orient yourself), list_directory, read_file, search_files,
  write_file, create_file. Paths are workspace-relative (e.g. "src/main.ino").
- ALWAYS read_file (or search_files) before editing a file you have not seen this session.
- For the currently open sketch, prefer edit_code/set_editor_code so the user sees changes live;
  use write_file for other files.
- If a tool says "No workspace folder is open", ask the user to open a project folder.
```

### 1.9 (Optional but recommended) light context hint — `src/main/ipc/aiHandlers.js`

In `ai:process-query`'s `enrichedContext` (aiHandlers.js:43), add:

```js
        workspaceRoot: uiState.workspaceRoot ?? null,
```

And in `agent.js` `processQuery`, where the `ctx` array is built (agent.js ~176), add:

```js
    if (context.workspaceRoot) {
      const name = String(context.workspaceRoot).split(/[/\\]/).pop();
      ctx.push(`project=${name}`);
    }
```

This tells the model a project is open (one token-cheap line); it then calls `get_project_tree` itself.

### 1.10 Phase 1 verification

1. `node --check` on: `workspace.js`, `toolExecutor.js`, `agent.js`, `main.js`, `preload.js`,
   `aiHandlers.js`, `systemPrompt.js`. (renderer.js is ESM — copy to `.mjs` to check.)
2. Manual: open a multi-file folder, ask the agent *"list the files in this project"* → it calls
   `get_project_tree`. Ask *"read platformio.ini"* → `read_file`. Ask *"add a README describing this
   sketch"* → `create_file`, README appears in the tree.
3. Ask it to modify a non-open file → `write_file`, tree refreshes; if that file is open, its tab updates.
4. Confirm `../` traversal is rejected: ask it to read `../../secret` → tool returns "outside the workspace".

### 1.11 Known Phase-1 limitation (resolved in Phase 2)

`write_file`/`create_file` apply **directly to disk** with no preview. This is acceptable for Phase 1
(fast to ship, tree/editor auto-refresh) but Phase 2 replaces it with a diff-preview + Accept/Reject
flow and a pre-write checkpoint. Until then, treat agent file writes like any code edit — review via git.

---

## PHASE 2 — Safe edits, diffs & checkpoints (design locked)

**Goal:** no silent overwrites; every AI file mutation is reviewable and reversible.

- **Diff preview + Accept/Reject.** `write_file`/`create_file`/`edit_code` become *proposals*, not
  direct writes. Executor returns a `pendingEdit` (path, oldContent, newContent). Renderer renders a
  unified diff card in the chat (green/red) with **Accept / Reject / Accept All** buttons. On Accept →
  call a new `workspace:apply-edit` IPC that writes to disk. Add a config toggle `autoApplyEdits`
  (default off) for power users.
  - Diff algorithm: add a tiny LCS line-diff helper (no dep needed) in a new
    `src/renderer/diff.js`; render as `<div class="diff-line add/del/ctx">`.
  - Design decision: keep the agent loop non-blocking — the tool returns "edit proposed, awaiting user"
    and the agent continues; acceptance is async and does not stall the loop.
- **Checkpoints / rewind.** Before the first file mutation of an agent turn, snapshot every file the
  turn will touch (old contents) into an in-memory + on-disk ring buffer
  (`%APPDATA%/arduino-ide-cursor/checkpoints/`). Add a "Rewind to before this message" button on user
  messages (extend the existing `takeCodeSnapshot`/`revertToSnapshot` machinery — already present for
  the single editor — to multi-file). IPC: `workspace:checkpoint`, `workspace:rewind`.
- **Plan mode.** Add a 4th AI mode `plan` alongside agent/ask/debug. In plan mode the tool set excludes
  all mutating tools (`write_file`, `create_file`, `edit_code`, `set_editor_code`, `upload_sketch`,
  `save_sketch`). Update `_getToolsForMode()` in `agent.js` and the mode `<select>` in `index.html`.

---

## PHASE 3 — Terminal & command execution (design locked)

**Goal:** surface the already-wired node-pty terminal and let the agent run build/test/flash commands.

- **Terminal panel UI.** Add a bottom "Terminal" tab (next to Console/Problems/Playground). Use
  `@xterm/xterm` + `@xterm/addon-fit` (add to deps). Wire to existing `terminal:create/write/resize/
  kill/data/exit` IPC (already in `main.js`/`preload.js`). One shared terminal, cwd = `state.folderRoot`.
- **`run_command` agent tool.** New tool → new executor method that spawns via `child_process.spawn`
  (NOT the pty; use a captured-output spawn for determinism) with `cwd = workspaceService.getRoot()`,
  a hard timeout (e.g. 60s), and an **allowlist / confirmation** gate. Return `{stdout, stderr, code}`
  (truncated to ~8 KB). Security decision: default-deny; maintain an allowlist of safe prefixes
  (`arduino-cli`, `pio`, `git status/diff/log`, `ls/dir`, `cat`, `npm run`) — anything else requires a
  one-click user confirmation surfaced in the chat. Reuse the arduinoService spawn-array pattern
  (never shell-string interpolation).
- This makes the agent able to compile/upload itself and read the real CLI output.

---

## PHASE 4 — Project memory & context intelligence (design locked)

- **`IMPULSE.md` project brain.** On workspace open, if `IMPULSE.md` exists at root, read it and inject
  (capped ~2 KB) into the system context every session. Add a `update_project_memory` tool so the agent
  can append learned facts (board quirks, pinout, conventions). Mirrors CLAUDE.md; version-controllable.
- **`@`-mention file injection.** In the AI input box, typing `@` opens a file picker (fuzzy over the
  project tree); selected files are read and prepended to that message's context. Renderer-only + uses
  `read_file`.
- **Smart auto-context.** Before a query, if a sketch is open, auto-include its `#include`d local
  headers (parse `#include "x.h"` → `read_file`) so the agent sees the real dependencies without asking.

---

## PHASE 5 — Autonomous verification (Antigravity-style, Arduino-specific) (design locked)

**Goal:** the agent closes the loop: compile → upload → watch serial → detect problem → fix → retry.

- New high-level tool `verify_on_hardware` (agent-orchestrated): compile (existing) → on success upload
  (existing) → connect serial (existing) → capture N seconds of output → analyze against expected
  behaviour → if anomaly, propose a fix (diff via Phase 2) and offer to retry. Bounded retries (e.g. 3).
- **Verifiable artifact panel.** Show a live "task list" / plan the agent is following (todo items with
  ✓/⋯/✗), plus captured serial snapshots as inspectable artifacts. New right-panel tab. This is the
  Antigravity "artifact" trust pattern adapted to embedded (serial output is our "browser preview").

---

## PHASE 6 — Multi-agent & polish (design locked, lowest priority)

- **Subagents.** Allow the main agent to spawn a scoped child (e.g. a read-only "researcher" that greps
  the codebase, or a "driver library" specialist) via a `spawn_subagent` tool; each child runs its own
  bounded `processQuery` loop with a restricted tool set and returns a summary. Reuse `AIAgent` with a
  child config.
- **Per-agent model choice** (tie into the model auto-upgrade system already built).
- Polish: streaming token-by-token rendering, cost/usage meter (we already track tokens), keyboard
  shortcuts, settings for thresholds/allowlists.

---

## Build order & dependency notes

```
Phase 1 (files)  ──▶ Phase 2 (diffs/checkpoints) ──▶ Phase 4 (memory/@context)
       │                     │                              │
       └────▶ Phase 3 (terminal/run_command) ──────────────┴──▶ Phase 5 (verify) ──▶ Phase 6 (multi-agent)
```

- Phase 1 is a hard prerequisite for everything.
- Phase 2 should land before heavy agent use (safety). Phase 3 can be done in parallel with Phase 2.
- Each phase is independently shippable and testable.

## Token-saving workflow note

Phase 1 above is mechanical — implement it with a cheaper model by following §1.1–1.10 verbatim, then
run the §1.10 verification. Bring the strong model back only to (a) sign off Phase 1, and (b) produce
the detailed code-level spec for the next phase (Phases 2–6 currently have design locked but not
line-level code).
