// ponytail: single-queue promise resolver for agent-authored edits.
// Ceiling: no timeout (user modal must be closed one way or another; if the
// user cancels the turn, rejectAll() unblocks). Upgrade if abandoned modals
// become an issue: add per-request TTL that auto-rejects.

class PendingEdits {
  constructor() {
    this.pending = new Map();
    this.nextId = 1;
    this.sender = null;
  }

  setSender(fn) { this.sender = fn; }

  /** Ask the UI to approve an edit. Resolves to true (accept) or false (reject). */
  request(payload) {
    if (typeof this.sender !== 'function') return Promise.resolve(true); // no UI → auto-accept
    const id = String(this.nextId++);
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      try { this.sender('ai:pending-edit', { id, ...payload }); }
      catch (_) { this.pending.delete(id); resolve(true); }
    });
  }

  decide(id, accepted) {
    const resolve = this.pending.get(id);
    if (!resolve) return;
    this.pending.delete(id);
    resolve(!!accepted);
  }

  rejectAll() {
    const hadPending = this.pending.size > 0;
    for (const resolve of this.pending.values()) resolve(false);
    this.pending.clear();
    // Tell the UI to drop any open approval modal — its decision no longer counts.
    if (hadPending && typeof this.sender === 'function') {
      try { this.sender('ai:pending-edit', { dismissAll: true }); } catch (_) { /* UI gone */ }
    }
  }
}

module.exports = new PendingEdits();
