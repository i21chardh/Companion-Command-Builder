import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('packaged preset API saves, updates, and reloads the same complete layout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ccb-preset-http-'));
  const path = join(directory, 'Monitor Layout.ccb-layout');
  const port = await availablePort();
  const coordinationPort = await availablePort();
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, COMPANION_BUILDER_PORT: String(port), CCB_COORDINATION_PORT: String(coordinationPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CCB preset test server did not start.')), 5000);
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`CCB preset test server exited ${code}.`)); });
      child.stdout.on('data', (chunk) => { if (String(chunk).includes('Companion Command Builder:')) { clearTimeout(timer); resolve(); } });
    });
    const button = (text) => ({ kind: 'create-button', button: { location: { page: 1, row: 0, column: 0 }, text, action: { family: 'audit', operation: 'go' }, appearance: { textColor: '#ffffff', backgroundColor: '#000000' } } });
    const document = { format: 'companion-command-builder-layout', schemaVersion: 1, model: 'offline:mk2', pages: [{ page: 1, name: 'Layer 1', plans: [button('GO')] }], workspaceSurfaces: [] };
    const request = (endpoint, value) => fetch(`http://127.0.0.1:${port}${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    let response = await request('/api/presets/save', { path, document });
    assert.equal(response.status, 200);
    response = await request('/api/presets/save', { path, document: { ...document, pages: [{ ...document.pages[0], plans: [button('UPDATED')] }] } });
    assert.equal(response.status, 200);
    response = await request('/api/presets/load', { path });
    assert.equal(response.status, 200);
    const loaded = await response.json();
    assert.equal(loaded.path, path);
    assert.equal(loaded.document.pages[0].plans[0].button.text, 'UPDATED');
  } finally {
    child.kill('SIGTERM');
    await rm(directory, { recursive: true, force: true });
  }
});
