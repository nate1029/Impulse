/**
 * Workspace jail — the agent's file tools must never escape the open folder.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const WorkspaceService = require('../workspace');

describe('WorkspaceService containment', () => {
  let root;
  let ws;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'impulse-ws-'));
    ws = new WorkspaceService();
    ws.setRoot(root);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('reads and writes inside the root', async () => {
    await ws.writeFile('sketch/blink.ino', 'void setup() {}');
    const r = await ws.readFile('sketch/blink.ino');
    expect(r.content).toBe('void setup() {}');
    expect(r.path).toBe('sketch/blink.ino');
  });

  test('rejects .. traversal', async () => {
    await expect(ws.readFile('../outside.txt')).rejects.toThrow(/outside the workspace/);
    await expect(ws.writeFile('a/../../evil.txt', 'x')).rejects.toThrow(/outside the workspace/);
  });

  test('rejects absolute paths outside the root', async () => {
    const outside = path.join(os.tmpdir(), 'impulse-outside.txt');
    await expect(ws.readFile(outside)).rejects.toThrow(/outside the workspace/);
  });

  test('rejects null bytes and empty paths', async () => {
    await expect(ws.readFile('a\0b')).rejects.toThrow(/null byte/);
    await expect(ws.readFile('')).rejects.toThrow(/required/);
  });

  test('rejects everything when no root is open', async () => {
    const closed = new WorkspaceService();
    await expect(closed.readFile('x.txt')).rejects.toThrow(/No workspace folder/);
  });

  test('symlink pointing outside the root is denied', async () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'impulse-out-'));
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret');
    const link = path.join(root, 'link');
    try {
      fs.symlinkSync(outsideDir, link, 'junction'); // junction: no admin needed on Windows
    } catch {
      return; // symlinks unavailable on this runner — nothing to verify
    }
    await expect(ws.readFile('link/secret.txt')).rejects.toThrow(/Access denied/);
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });
});
