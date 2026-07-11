/**
 * Chat History Service
 * Persists AI conversations as named sessions under userData/chat-sessions/.
 * index.json holds lightweight metadata; each session body lives in <id>.json.
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { app } = require('electron');

const MAX_SESSIONS = 100;

class ChatHistoryService {
  constructor() {
    this.dir = path.join(app.getPath('userData'), 'chat-sessions');
    this.indexPath = path.join(this.dir, 'index.json');
    fs.mkdirSync(this.dir, { recursive: true });
    // Serialize all mutations: concurrent appends read-modify-write the same
    // JSON files and drop messages. ponytail: global queue; per-session queues if it ever matters.
    this._q = Promise.resolve();
  }

  _enqueue(work) {
    const run = this._q.then(work, work);
    // keep the chain alive even when work rejects
    this._q = run.catch(() => {});
    return run;
  }

  async _readIndex() {
    try {
      const raw = await fsp.readFile(this.indexPath, 'utf8');
      const idx = JSON.parse(raw);
      return Array.isArray(idx) ? idx : [];
    } catch { return []; }
  }

  async _writeIndex(index) {
    await fsp.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  _sessionPath(id) {
    // ids are generated internally (see create) — sanitize anyway
    const safe = String(id).replace(/[^a-z0-9-]/gi, '');
    return path.join(this.dir, `${safe}.json`);
  }

  /** List sessions, newest first. */
  async list() {
    const index = await this._readIndex();
    return index.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async get(id) {
    try {
      const raw = await fsp.readFile(this._sessionPath(id), 'utf8');
      return JSON.parse(raw);
    } catch { return null; }
  }

  /** Create a session; title is derived from the first user message. */
  create(title, model) { return this._enqueue(() => this._create(title, model)); }
  async _create(title, model) {
    const id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const meta = {
      id,
      title: String(title || 'New chat').slice(0, 60),
      model: model || null,
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    };
    const index = await this._readIndex();
    index.unshift(meta);
    // Cap total stored sessions; delete overflow bodies
    while (index.length > MAX_SESSIONS) {
      const dropped = index.pop();
      try { await fsp.unlink(this._sessionPath(dropped.id)); } catch (_) { /* already gone */ }
    }
    await this._writeIndex(index);
    await fsp.writeFile(this._sessionPath(id), JSON.stringify({ ...meta, messages: [] }, null, 2), 'utf8');
    return meta;
  }

  /** Append a message {role, content, ts?, tools?} to a session. */
  append(id, message) { return this._enqueue(() => this._append(id, message)); }
  async _append(id, message) {
    const session = await this.get(id);
    if (!session) throw new Error('Session not found');
    session.messages.push({
      role: message.role || 'user',
      content: String(message.content ?? ''),
      ts: message.ts || Date.now(),
      ...(message.tools ? { tools: message.tools } : {})
    });
    session.updatedAt = Date.now();
    session.messageCount = session.messages.length;
    if (message.model) session.model = message.model;
    await fsp.writeFile(this._sessionPath(id), JSON.stringify(session, null, 2), 'utf8');

    const index = await this._readIndex();
    const meta = index.find(s => s.id === id);
    if (meta) {
      meta.updatedAt = session.updatedAt;
      meta.messageCount = session.messageCount;
      if (session.model) meta.model = session.model;
      await this._writeIndex(index);
    }
    return { success: true };
  }

  rename(id, title) { return this._enqueue(() => this._rename(id, title)); }
  async _rename(id, title) {
    const session = await this.get(id);
    if (!session) throw new Error('Session not found');
    session.title = String(title || '').slice(0, 60) || session.title;
    await fsp.writeFile(this._sessionPath(id), JSON.stringify(session, null, 2), 'utf8');
    const index = await this._readIndex();
    const meta = index.find(s => s.id === id);
    if (meta) { meta.title = session.title; await this._writeIndex(index); }
    return { success: true };
  }

  remove(id) { return this._enqueue(() => this._remove(id)); }
  async _remove(id) {
    const index = await this._readIndex();
    const next = index.filter(s => s.id !== id);
    await this._writeIndex(next);
    try { await fsp.unlink(this._sessionPath(id)); } catch (_) { /* already gone */ }
    return { success: true };
  }
}

module.exports = ChatHistoryService;
