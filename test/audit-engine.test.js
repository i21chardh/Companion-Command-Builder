import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAuditEngine } from '../src/audit-engine.js';
import { auditCorrectedCommands, auditOnboardedModuleCommands } from '../src/audit-regressions.js';
import { auditLiveReadback } from '../src/audit-live-readback.js';

test('the engine treats offline, generated, corrected, and live checks as standard processes', async () => {
  const report = await runAuditEngine([
    { id: 'offline', type: 'offline-regression', run: async () => ({ cases: [{ id: 'one', status: 'pass' }] }) },
    { id: 'live', type: 'temporary-control-readback', run: async () => ({ cases: [{ id: 'two', status: 'pending' }] }) },
  ]);
  assert.equal(report.gate, 'PASS-WITH-PENDING');
  assert.deepEqual(report.totals, { cases: 2, passed: 1, failed: 0, pending: 1, skipped: 0 });
  assert.deepEqual(report.processes.map((item) => item.type), ['offline-regression', 'temporary-control-readback']);
});
test('onboarded live schemas automatically generate and run common-command cases', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-unified-audit-'));
  const databasePath = join(root, 'module-onboarding.json');
  const languageMemoryPath = join(root, 'language-memory.json');
  const adapter = {
    format: 'ccb-dynamic-adapter', schemaVersion: 1, moduleId: 'test-lighting', version: '1.0.0', name: 'Test Lighting',
    routingAliases: ['test lighting', 'lighting'], intentMappings: [{ actionId: 'startShow', phrases: ['start show'] }],
    actions: [{ id: 'startShow', name: 'Start Show', options: [] }],
  };
  await writeFile(databasePath, JSON.stringify({ format: 'ccb-module-onboarding', schemaVersion: 1, modules: {
    'test-lighting': { moduleId: 'test-lighting', name: 'Test Lighting', version: '1.0.0', compiledAdapter: adapter },
  } }));
  await writeFile(languageMemoryPath, JSON.stringify({ format: 'ccb-language-memory', schemaVersion: 1, examples: [{
    key: 'test-lighting|startShow|test lighting start show', original: 'test lighting start show at 1/1/1', moduleId: 'test-lighting', actionId: 'startShow', corrected: true,
  }] }));
  const generated = await auditOnboardedModuleCommands({ databasePath });
  assert.ok(generated.cases.length >= 1);
  assert.ok(generated.cases.every((item) => item.status === 'pass'));
  const corrections = await auditCorrectedCommands({ databasePath, languageMemoryPath });
  assert.equal(corrections.cases[0].status, 'pass');
  assert.equal(corrections.cases[0].actualActionId, 'startShow');
});

test('live read-back creates no presses and requires verified cleanup evidence', async () => {
  const instances = [{ id: 'shure', value: JSON.stringify({ moduleInstanceType: 'connection', moduleId: 'shure-wireless', moduleVersionId: '2.3.1', label: 'AD4Q', enabled: true, config: { modelID: 'ad4q' } }) }];
  let requested = null;
  const report = await auditLiveReadback({ instances, dependencies: {
    discoverSurfaces: async () => [{ id: 'deck', rows: 4, columns: 8, xOffset: 0, yOffset: 0, enabled: true, connected: true }],
    discoverConnectionDefinitions: async () => ({ actions: { slot_rf_power: { name: 'Slot RF Power', options: [{ id: 'slot', required: true }, { id: 'power', required: true }] } }, feedbacks: {} }),
    validateDynamicAdapterReadback: async (...args) => { requested = args[5]; return { verified: true, cleanedUp: true, actionId: 'slot_rf_power', options: requested.options, location: { page: 1, row: 0, column: 0 } }; },
  } });
  assert.deepEqual(requested, { actionId: 'slot_rf_power', options: { slot: '1:1', power: 'NORMAL' } });
  assert.equal(report.cases[0].status, 'pass');
  assert.equal(report.evidence[0].cleanedUp, true);
});
