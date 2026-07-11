/**
 * Workspace Service
 * Filesystem access confined to the currently open project folder (the "root").
 * All agent file tools go through here. Paths may be workspace-relative or absolute;
 * either way the resolved path MUST stay inside the root or the call is rejected.
 */
const fs = require('fs').promises;
const fssync = require('fs');
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
    // Lexical check passed — now make sure no symlink smuggles the real
    // target outside the root. Walk up to the nearest existing ancestor
    // (the file itself may not exist yet on writes) and compare realpaths.
    try {
      let probe = abs;
      while (!fssync.existsSync(probe)) probe = path.dirname(probe);
      const real = fssync.realpathSync(probe);
      const realRoot = fssync.realpathSync(this.root);
      const realRel = path.relative(realRoot, real);
      if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
        throw new Error(`Access denied: "${p}" resolves outside the workspace (symlink).`);
      }
    } catch (e) {
      if (String(e.message).startsWith('Access denied')) throw e;
      // realpath failed (permissions, root vanished) — fail closed.
      throw new Error(`Access denied: cannot verify "${p}" stays inside the workspace.`);
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

  /** Flat list of workspace-relative paths for the @-mention picker. Capped. */
  async listFilesFlat(maxEntries = 2000) {
    if (!this.root) return [];
    const out = [];
    const walk = async (dir) => {
      if (out.length >= maxEntries) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (out.length >= maxEntries) return;
        if (e.name.startsWith('.')) continue;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (IGNORED_DIRS.has(e.name)) continue;
          out.push({ rel: this._rel(abs), isDir: true });
          await walk(abs);
        } else {
          out.push({ rel: this._rel(abs), isDir: false });
        }
      }
    };
    await walk(this.root);
    return out;
  }

  /** grep-style search across text files. Returns [{path, line, text}]. */
  async searchFiles(query, opts = {}) {
    if (!this.root) throw new Error('No workspace folder is open.');
    if (!query) throw new Error('Search query required');
    if (query.length > 300) throw new Error('Search query too long (max 300 chars)');
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
