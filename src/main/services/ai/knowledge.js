const fs = require('fs');
const path = require('path');

// ponytail: flat-inject KB + IMPULSE.md into every system prompt.
// Total ceiling ~3k tokens. When it grows past that, swap for an embedding
// index + a read_knowledge tool. Path: hash each .md, MiniLM embeddings on
// disk, top-k retrieve per turn.

const KB_DIR = path.join(__dirname, '..', '..', '..', '..', 'knowledge');

let KB_CACHE = null;

function loadKB() {
  if (KB_CACHE !== null) return KB_CACHE;
  try {
    if (!fs.existsSync(KB_DIR)) { KB_CACHE = ''; return ''; }
    const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md')).sort();
    const parts = files.map(name => {
      const body = fs.readFileSync(path.join(KB_DIR, name), 'utf8').trim();
      return `### ${name}\n${body}`;
    });
    KB_CACHE = parts.join('\n\n');
  } catch (_) { KB_CACHE = ''; }
  return KB_CACHE;
}

function readProjectMemory(workspaceRoot) {
  if (!workspaceRoot) return '';
  try {
    const p = path.join(workspaceRoot, 'IMPULSE.md');
    if (!fs.existsSync(p)) return '';
    return fs.readFileSync(p, 'utf8').trim();
  } catch (_) { return ''; }
}

/** Build the block appended to the system prompt for this turn. */
function buildContextBlock(workspaceRoot) {
  const kb = loadKB();
  const proj = readProjectMemory(workspaceRoot);
  const blocks = [];
  if (kb) blocks.push(`## Impulse Knowledge Base\nCurated Arduino/IoT reference. Prefer these over guessing.\n\n${kb}`);
  if (proj) blocks.push(`## Project Notes (IMPULSE.md)\nThe user's project-specific rules and context. Follow them.\n\n${proj}`);
  return blocks.length ? '\n\n---\n\n' + blocks.join('\n\n---\n\n') : '';
}

module.exports = { buildContextBlock, loadKB, readProjectMemory };
