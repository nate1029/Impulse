const fs = require('fs');
const path = require('path');

// ponytail: JSONL append-only, no rotation. Ceiling ~10MB before it becomes
// awkward to load. Upgrade path: rotate at 1MB, keep last 5 files, or move to
// SQLite when we start doing few-shot retrieval on it.

function getFeedbackPath() {
  let dir;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') dir = app.getPath('userData');
  } catch (_) { /* not in Electron */ }
  if (!dir) {
    dir = path.join(
      process.env.APPDATA ||
        (process.platform === 'darwin'
          ? path.join(process.env.HOME, 'Library/Preferences')
          : path.join(process.env.HOME, '.config')),
      'arduino-ide-cursor'
    );
  }
  return path.join(dir, 'feedback.jsonl');
}

function recordFeedback(entry) {
  const file = getFeedbackPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const row = JSON.stringify({ ts: Date.now(), ...entry }) + '\n';
  fs.appendFileSync(file, row, 'utf8');
  return { success: true };
}

module.exports = { recordFeedback, getFeedbackPath };
