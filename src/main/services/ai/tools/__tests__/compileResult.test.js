/**
 * compile_sketch result shaping.
 *
 * Two things that directly affect cost and the agent's ability to fix builds:
 *  - a SUCCESSFUL compile must NOT ship the whole --verbose log to the model
 *    (tens of thousands of wasted tokens on ESP32);
 *  - a FAILED compile MUST surface the real compiler errors, or the agent is
 *    blind to why it failed and can't fix it.
 */
const ToolExecutor = require('../toolExecutor');

function exWith(arduino) {
  const ex = new ToolExecutor(arduino, null, null, null, null);
  ex.setUICallbacks({
    getCurrentSketchPath: async () => '/sk/s.ino',
    getSelectedBoard: async () => 'esp32:esp32:esp32',
    saveSketch: async () => {},
  });
  return ex;
}

test('successful compile sends a compact summary, not the verbose log', async () => {
  const hugeLog = 'Compiling core file...\n'.repeat(5000); // ~100KB of noise
  const ex = exWith({
    compile: async () => ({ success: true, output: hugeLog, message: 'ok', programSize: 284512, usagePercent: 21, warnings: [] }),
  });
  const r = await ex.execute({ name: 'compile_sketch', arguments: {} });
  expect(r.success).toBe(true);
  const payload = r.result;
  expect(payload.programSize).toBe(284512);
  expect(payload.usagePercent).toBe(21);
  // the giant build log must not be forwarded to the model
  expect(JSON.stringify(payload)).not.toContain('Compiling core file');
  expect(JSON.stringify(payload).length).toBeLessThan(2000);
});

test('failed compile surfaces parsed errors AND the raw output tail', async () => {
  const ex = exWith({
    compile: async () => {
      const e = new Error('Compilation failed');
      e.errors = ["main.ino:5:3: error: 'foo' was not declared in this scope"];
      e.output = 'noise\n'.repeat(200) + "main.ino:5:3: error: 'foo' was not declared in this scope";
      throw e;
    },
  });
  const r = await ex.execute({ name: 'compile_sketch', arguments: {} });
  expect(r.success).toBe(false); // wrapper propagates the failure
  const payload = r.result;
  expect(payload.errors[0]).toMatch(/foo.*not declared/);
  expect(payload.output).toMatch(/not declared/); // real error reaches the model
});

test('a very long failure log is tail-trimmed, not dropped', async () => {
  const ex = exWith({
    compile: async () => {
      const e = new Error('Compilation failed');
      e.output = 'x'.repeat(20000) + '\nFATAL: linker error here';
      throw e;
    },
  });
  const r = await ex.execute({ name: 'compile_sketch', arguments: {} });
  expect(r.result.output).toMatch(/truncated/);
  expect(r.result.output).toMatch(/linker error here/); // the important tail survives
  expect(r.result.output.length).toBeLessThan(6100);
});
