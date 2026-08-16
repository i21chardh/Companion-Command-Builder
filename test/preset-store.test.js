import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deserializePresetDocument, loadPresetFile, savePresetFile, serializePresetDocument, validPresetPath } from '../src/preset-store.js';

function threeButtonPreset() {
  const button = (row, column, text) => ({
    kind: 'create-button',
    button: { location: { page: 1, row, column }, text, appearance: { textColor: '#ffffff', backgroundColor: '#000000' }, action: { family: 'test', operation: text.toLowerCase() } },
  });
  return {
    format: 'companion-command-builder-layout', schemaVersion: 1, appVersion: 'audit', model: 'offline:mk2',
    pages: [{ page: 1, name: 'Layer 1', plans: [button(1, 1, 'PLAY'), button(1, 2, 'STOP'), button(1, 3, 'RECORD')] }],
    workspaceSurfaces: [],
  };
}

test('preset serialization round-trips every page and button exactly', () => {
  const preset = threeButtonPreset();
  assert.deepEqual(deserializePresetDocument(serializePresetDocument(preset)), preset);
});

test('Save, Save As storage, and Load round-trip a real CCB layout file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ccb-preset-audit-'));
  try {
    const first = join(directory, 'Monitor Layout.ccb-layout');
    const saveAs = join(directory, 'Monitor Layout Copy.ccb-layout');
    const preset = threeButtonPreset();
    await savePresetFile(first, preset);
    await savePresetFile(first, { ...preset, name: 'Updated session' });
    await savePresetFile(saveAs, preset);
    assert.deepEqual(await loadPresetFile(first), { ...preset, name: 'Updated session' });
    assert.deepEqual(await loadPresetFile(saveAs), preset);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('preset storage rejects unsupported paths and malformed documents', async () => {
  assert.throws(() => validPresetPath('relative.ccb-layout'), /valid local preset/);
  assert.throws(() => validPresetPath('/tmp/layout.txt'), /must end/);
  assert.throws(() => deserializePresetDocument('{"format":"wrong"}'), /invalid/);
});
