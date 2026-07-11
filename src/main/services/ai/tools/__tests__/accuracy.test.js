/**
 * Agent accuracy harness — the deterministic layer.
 *
 * The LLM picks tools and arguments; THIS layer executes them. If the executor
 * silently mangles a file or reports success when nothing changed, no amount of
 * model intelligence saves the user. These tests measure exactly that: given a
 * well-formed tool call, does the executor do the right thing — and, just as
 * important, does it FAIL LOUDLY when the call is subtly wrong (hallucinated
 * line numbers, search text that isn't there)?
 *
 * No API keys, no hardware — pure logic. Run: npx jest accuracy.test.js
 */
const ToolExecutor = require('../toolExecutor');

/** In-memory editor so we can drive edit_code / replace_in_code deterministically. */
function makeExecutor(initialCode = '') {
  let code = initialCode;
  const ex = new ToolExecutor(null, null, null, null, null);
  ex.setUICallbacks({
    getEditorCode: async () => code,
    setEditorCode: async (c) => { code = c; },
  });
  return { ex, getCode: () => code };
}

const SKETCH = [
  'void setup() {',                       // 1
  '  pinMode(LED_BUILTIN, OUTPUT);',      // 2
  '}',                                    // 3
  '',                                     // 4
  'void loop() {',                        // 5
  '  digitalWrite(LED_BUILTIN, HIGH);',   // 6
  '  delay(1000);',                       // 7
  '}',                                    // 8
].join('\n');

describe('edit_code — line-based mutation', () => {
  test('replace a single line hits exactly that line', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    const r = await ex.execute({ name: 'edit_code', arguments: { operation: 'replace', startLine: 7, endLine: 7, newCode: '  delay(250);' } });
    expect(r.success).toBe(true);
    expect(getCode().split('\n')[6]).toBe('  delay(250);');
    expect(getCode().split('\n')[5]).toBe('  digitalWrite(LED_BUILTIN, HIGH);'); // neighbour untouched
  });

  test('insert pushes existing lines down, none lost', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    const before = getCode().split('\n').length;
    await ex.execute({ name: 'edit_code', arguments: { operation: 'insert', startLine: 6, newCode: '  Serial.println("tick");' } });
    const after = getCode().split('\n');
    expect(after.length).toBe(before + 1);
    expect(after[5]).toBe('  Serial.println("tick");');
    expect(after[6]).toBe('  digitalWrite(LED_BUILTIN, HIGH);');
  });

  test('delete removes exactly the range', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    await ex.execute({ name: 'edit_code', arguments: { operation: 'delete', startLine: 6, endLine: 7 } });
    const after = getCode();
    expect(after).not.toContain('digitalWrite');
    expect(after).not.toContain('delay(1000)');
    expect(after).toContain('void loop()');
  });

  // ---- The accuracy-critical cases: bad input must NOT silently corrupt ----

  test('out-of-range startLine is rejected, file left intact', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    const r = await ex.execute({ name: 'edit_code', arguments: { operation: 'replace', startLine: 999, endLine: 999, newCode: 'garbage' } });
    expect(r.success).toBe(false);          // must report failure...
    expect(getCode()).toBe(SKETCH);         // ...and NOT mutate the file
  });

  test('startLine past end does not append silently', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    await ex.execute({ name: 'edit_code', arguments: { operation: 'insert', startLine: 500, newCode: 'orphan' } });
    expect(getCode()).not.toContain('orphan'); // an insert at line 500 of an 8-line file is a mistake
  });

  test('inverted range (end < start) is rejected', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    const r = await ex.execute({ name: 'edit_code', arguments: { operation: 'replace', startLine: 7, endLine: 2, newCode: 'x' } });
    expect(r.success).toBe(false);
    expect(getCode()).toBe(SKETCH);
  });
});

describe('replace_in_code — text substitution', () => {
  test('replaces text that exists', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    const r = await ex.execute({ name: 'replace_in_code', arguments: { searchText: 'delay(1000)', replaceText: 'delay(500)' } });
    expect(r.success).toBe(true);
    expect(r.result.replacementCount).toBe(1);
    expect(getCode()).toContain('delay(500)');
  });

  test('search text that is absent reports NO success', async () => {
    const { ex, getCode } = makeExecutor(SKETCH);
    const r = await ex.execute({ name: 'replace_in_code', arguments: { searchText: 'analogWrite(9, 128)', replaceText: 'x' } });
    // The agent must learn the edit did not land — otherwise it "fixes" bugs that are still there.
    const landed = r.success === true && r.result.replacementCount > 0;
    expect(landed).toBe(false);
    expect(getCode()).toBe(SKETCH); // unchanged
  });
});

describe('schema validation — malformed calls are caught', () => {
  test('missing required param is rejected', async () => {
    const { ex } = makeExecutor(SKETCH);
    const r = await ex.execute({ name: 'edit_code', arguments: { operation: 'replace' } }); // no startLine
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/startLine|required/i);
  });

  test('unknown tool is rejected', async () => {
    const { ex } = makeExecutor(SKETCH);
    const r = await ex.execute({ name: 'flash_firmware_9000', arguments: {} });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/unknown tool/i);
  });
});
