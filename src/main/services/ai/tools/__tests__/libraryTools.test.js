/**
 * Library tools — the agent can now find, install, list, and remove Arduino
 * libraries. These test the executor wiring (dispatch + arg passing + shape),
 * with arduino-cli stubbed so no network/CLI is touched.
 */
const ToolExecutor = require('../toolExecutor');

function makeExecutor() {
  const calls = [];
  const arduino = {
    libSearch: async (q) => { calls.push(['libSearch', q]); return { libraries: [
      { name: 'ArduinoJson', author: 'Benoit', version: '6.21.3', sentence: 'JSON library' },
      { name: 'ArduinoJson-Extra', author: 'x', version: '1.0.0', sentence: 'other' },
    ] }; },
    libInstall: async (spec) => { calls.push(['libInstall', spec]); return { success: true, output: 'Installed ' + spec }; },
    libList: async () => { calls.push(['libList']); return { installed_libraries: [
      { name: 'ArduinoJson', version: '6.21.3' },
    ] }; },
    libUninstall: async (name) => { calls.push(['libUninstall', name]); return { success: true }; },
    coreSearch: async (q) => { calls.push(['coreSearch', q]); return [
      { id: 'esp32:esp32', name: 'esp32', latest: '3.0.0' },
    ]; },
    coreInstall: async (id) => { calls.push(['coreInstall', id]); return { success: true, output: 'Installed ' + id }; },
    coreList: async () => { calls.push(['coreList']); return [
      { id: 'arduino:avr', name: 'Arduino AVR', installed: '1.8.6' },
    ]; },
  };
  const ex = new ToolExecutor(arduino, null, null, null, null);
  return { ex, calls };
}

test('search_libraries returns trimmed candidates and passes the query through', async () => {
  const { ex, calls } = makeExecutor();
  const r = await ex.execute({ name: 'search_libraries', arguments: { query: 'json' } });
  expect(r.success).toBe(true);
  expect(calls).toContainEqual(['libSearch', 'json']);
  expect(r.result.libraries[0]).toEqual({ name: 'ArduinoJson', author: 'Benoit', version: '6.21.3', description: 'JSON library' });
});

test('install_library forwards the exact name/version spec', async () => {
  const { ex, calls } = makeExecutor();
  const r = await ex.execute({ name: 'install_library', arguments: { name: 'ArduinoJson@6.21.3' } });
  expect(r.success).toBe(true);
  expect(calls).toContainEqual(['libInstall', 'ArduinoJson@6.21.3']);
});

test('install_library surfaces CLI failure instead of throwing', async () => {
  const { ex } = makeExecutor();
  ex.arduinoService.libInstall = async () => { throw new Error('Library not found'); };
  const r = await ex.execute({ name: 'install_library', arguments: { name: 'Nonexistent' } });
  // Executor wraps a thrown error; the agent sees success:false via the result payload.
  const payload = r.result || r;
  expect(payload.success === false || r.success === false).toBe(true);
});

test('list_libraries reports installed names + versions', async () => {
  const { ex } = makeExecutor();
  const r = await ex.execute({ name: 'list_libraries', arguments: {} });
  expect(r.result.installed).toEqual([{ name: 'ArduinoJson', version: '6.21.3' }]);
});

test('uninstall_library forwards the name', async () => {
  const { ex, calls } = makeExecutor();
  await ex.execute({ name: 'uninstall_library', arguments: { name: 'ArduinoJson' } });
  expect(calls).toContainEqual(['libUninstall', 'ArduinoJson']);
});

test('install_library rejects a missing name (schema required param)', async () => {
  const { ex } = makeExecutor();
  const r = await ex.execute({ name: 'install_library', arguments: {} });
  expect(r.success).toBe(false);
  expect(r.error).toMatch(/name|required/i);
});

test('the library + board-core tools are registered in the agent tool set', () => {
  const { getAllTools } = require('../toolSchema');
  const names = getAllTools().map(t => t.name);
  for (const t of [
    'search_libraries', 'install_library', 'list_libraries', 'uninstall_library',
    'search_board_cores', 'install_board_core', 'list_board_cores',
  ]) {
    expect(names).toContain(t);
  }
});

describe('board core tools', () => {
  test('search_board_cores returns core IDs and passes the query', async () => {
    const { ex, calls } = makeExecutor();
    const r = await ex.execute({ name: 'search_board_cores', arguments: { query: 'esp32' } });
    expect(r.success).toBe(true);
    expect(calls).toContainEqual(['coreSearch', 'esp32']);
    expect(r.result.cores[0].id).toBe('esp32:esp32');
  });

  test('install_board_core forwards the exact core ID', async () => {
    const { ex, calls } = makeExecutor();
    const r = await ex.execute({ name: 'install_board_core', arguments: { id: 'esp32:esp32' } });
    expect(r.success).toBe(true);
    expect(calls).toContainEqual(['coreInstall', 'esp32:esp32']);
  });

  test('install_board_core surfaces failure at the top level', async () => {
    const { ex } = makeExecutor();
    ex.arduinoService.coreInstall = async () => { throw new Error('network down'); };
    const r = await ex.execute({ name: 'install_board_core', arguments: { id: 'esp32:esp32' } });
    expect(r.success).toBe(false); // wrapper now propagates internal failure
  });

  test('list_board_cores reports installed core IDs + versions', async () => {
    const { ex } = makeExecutor();
    const r = await ex.execute({ name: 'list_board_cores', arguments: {} });
    expect(r.result.installed).toEqual([{ id: 'arduino:avr', version: '1.8.6' }]);
  });
});
