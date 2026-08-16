import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverInstalledModules, runAdapterAudit, validateAdapterManifest } from '../src/adapters/audit.js';
import { ADAPTERS } from '../src/adapters/index.js';

test('all implemented adapter manifests pass the common schema', () => {
  for (const adapter of ADAPTERS.values()) assert.deepEqual(validateAdapterManifest(adapter), [], adapter.moduleId);
});

test('adapter audit reports installed and absent modules without false live verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-adapters-'));
  const manifestDir = join(root, 'waves-lv1-1.0.4', 'companion');
  await mkdir(manifestDir, { recursive: true });
  await writeFile(join(manifestDir, 'manifest.json'), JSON.stringify({ id: 'waves-lv1', name: 'waves-lv1', version: '1.0.4' }));
  const report = await runAdapterAudit({ modulesRoot: root, companionAddress: '127.0.0.1:1', targets: ['waves-lv1', 'obs-studio'] });
  assert.equal(report.results[0].schemaPassed, true);
  assert.equal(report.results[0].versionMatched, true);
  assert.equal(report.results[0].liveDeployment, 'blocked');
  assert.equal(report.results[1].installed, false);
  assert.equal(report.results[1].adapterImplemented, false);
});

test('LV1 audited actions exclude phantom power', () => {
  const lv1 = ADAPTERS.get('waves-lv1');
  assert.ok(lv1.actionIds.includes('talkBackToOutput'));
  assert.ok(!lv1.actionIds.includes('phantom'));
  assert.deepEqual(lv1.excludedActionIds, ['phantom']);
});

test('discovers stored Companion connection modules for the GUI selector', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-module-picker-'));
  const connection = join(root, 'obs-studio-3.15.3', 'companion');
  const surface = join(root, 'surface-test-1.0.0', 'companion');
  await mkdir(connection, { recursive: true }); await mkdir(surface, { recursive: true });
  await writeFile(join(connection, 'manifest.json'), JSON.stringify({ type: 'connection', id: 'obs-studio', name: 'obs-studio', manufacturer: 'OBS', products: ['Studio'], version: '3.15.3' }));
  await writeFile(join(surface, 'manifest.json'), JSON.stringify({ type: 'surface', id: 'surface-test', name: 'Surface', version: '1.0.0' }));
  assert.deepEqual(await discoverInstalledModules(root), [{ moduleId: 'obs-studio', version: '3.15.3', versionId: '3.15.3', product: 'Studio', products: ['Studio'], name: 'OBS: Studio' }]);
});
