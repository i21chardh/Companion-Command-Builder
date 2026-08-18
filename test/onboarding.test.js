import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditOnboardingPrompts, configureModuleSupport, generateOnboardingPrompts, saveDynamicValidationResult, savePendingReadback, syncModuleOnboardingDatabase } from '../src/adapters/onboarding.js';

test('generates deterministic prompt candidates from newly installed module help', () => {
  const module = { moduleId: 'test-lighting', version: '1.0.0', name: 'Test Lighting' };
  const prompts = generateOnboardingPrompts(module, '# Actions\n- Set fixture intensity\n- Recall scene\n');
  assert.ok(prompts.some((item) => item.prompt.includes('Set fixture intensity')));
  const results = auditOnboardingPrompts(module, prompts);
  assert.equal(results.length, prompts.length);
  assert.ok(results.every((item) => ['adapter-required', 'parser-required', 'pass', 'wrong-module'].includes(item.status)));
});

test('graduates a compiled dynamic adapter after exact Companion read-back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-onboarding-readback-'));
  const databasePath = join(root, 'module-onboarding.json');
  await writeFile(databasePath, JSON.stringify({
    format: 'ccb-module-onboarding', schemaVersion: 1, modules: {
      'test-module': { compiledAdapter: { actions: [{ id: 'go', name: 'Go' }] }, gates: { schemaTested: true, supported: false } },
    },
  }));
  const record = await saveDynamicValidationResult('test-module', { verified: true }, databasePath);
  assert.equal(record.gates.readbackVerified, true);
  assert.equal(record.gates.supported, true);
  assert.ok(record.supportedAt);
});

test('stores a terminal waiting state when no surface is available for read-back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-onboarding-pending-readback-'));
  const databasePath = join(root, 'module-onboarding.json');
  await writeFile(databasePath, JSON.stringify({ format: 'ccb-module-onboarding', schemaVersion: 1, modules: {
    'test-module': { compiledAdapter: { actions: [{ id: 'go' }] }, gates: { schemaTested: true } },
  } }));
  const record = await savePendingReadback('test-module', 'Connect a surface', databasePath);
  assert.equal(record.pendingReadback, true);
  assert.equal(record.gates.supported, false);
  assert.equal(record.readbackError, 'Connect a surface');
});

test('updates the persistent onboarding database when a module is added', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-onboarding-'));
  const moduleRoot = join(root, 'modules');
  const companion = join(moduleRoot, 'test-lighting-1.0.0', 'companion');
  const databasePath = join(root, 'state', 'module-onboarding.json');
  await mkdir(companion, { recursive: true });
  await writeFile(join(companion, 'manifest.json'), JSON.stringify({ type: 'connection', id: 'test-lighting', name: 'Lighting', version: '1.0.0', products: ['Lighting'] }));
  await writeFile(join(companion, 'HELP.md'), '# Actions\n- Set fixture intensity\n- Recall scene\n');
  const result = await syncModuleOnboardingDatabase({ modulesRoot: moduleRoot, databasePath });
  assert.deepEqual(result.changed, ['test-lighting']);
  const saved = JSON.parse(await readFile(databasePath, 'utf8'));
  assert.equal(saved.modules['test-lighting'].version, '1.0.0');
  assert.ok(saved.modules['test-lighting'].prompts.length >= 2);
  const unchanged = await syncModuleOnboardingDatabase({ modulesRoot: moduleRoot, databasePath });
  assert.deepEqual(unchanged.changed, []);
  const configured = await configureModuleSupport('test-lighting', { modulesRoot: moduleRoot, databasePath, useAi: false });
  assert.equal(configured.gates.actionDiscovery, true);
  assert.equal(configured.gates.corpusGenerated, false);
  assert.ok(configured.counts['adapter-required'] + configured.counts['parser-required'] > 0);
  const offlineConfigured = await configureModuleSupport('test-lighting', { modulesRoot: moduleRoot, databasePath, useAi: false, connectionError: 'Host unreachable' });
  assert.equal(offlineConfigured.pendingConnection, true);
  assert.equal(offlineConfigured.gates.connectionValidated, false);
  assert.equal(offlineConfigured.connectionError, 'Host unreachable');
});

test('completes documentation-backed parser mapping before live schema validation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-onboarding-language-map-'));
  const moduleRoot = join(root, 'modules');
  const companion = join(moduleRoot, 'test-show-control-1.0.0', 'companion');
  const databasePath = join(root, 'module-onboarding.json');
  await mkdir(companion, { recursive: true });
  await writeFile(join(companion, 'manifest.json'), JSON.stringify({ type: 'connection', id: 'test-show-control', name: 'Show Control', version: '1.0.0' }));
  await writeFile(join(companion, 'HELP.md'), '# Actions\n- Start cue\n- Stop cue\n- Pause cue\n- Resume cue\n- Select cue\n- Panic all\n');
  const configured = await configureModuleSupport('test-show-control', { modulesRoot: moduleRoot, databasePath, useAi: false, connectionError: 'Host unavailable' });
  assert.equal(configured.gates.corpusGenerated, true);
  assert.equal(configured.gates.parserMapped, true);
  assert.equal(configured.gates.schemaTested, false);
  assert.equal(configured.pendingConnection, true);
});

test('onboarding compiles routing aliases and deterministic intents from a live third-party schema', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-onboarding-dante-'));
  const moduleRoot = join(root, 'modules');
  const companion = join(moduleRoot, 'audinate-dantecontroller-1.1.2', 'companion');
  const databasePath = join(root, 'module-onboarding.json');
  await mkdir(companion, { recursive: true });
  await writeFile(join(companion, 'manifest.json'), JSON.stringify({
    type: 'connection', id: 'audinate-dantecontroller', name: 'Dante Controller', manufacturer: 'Audinate', version: '1.1.2', products: ['Dante Controller'],
  }));
  await writeFile(join(companion, 'HELP.md'), '# Actions\n- Set device name\n');
  const actions = Object.fromEntries(['setDeviceName', 'setDeviceNameCustom', 'resetDeviceName', 'setRxChannelName', 'resetRxChannelName', 'setTxChannelName'].map((id) => [id, { name: id, options: [] }]));
  const configured = await configureModuleSupport('audinate-dantecontroller', {
    modulesRoot: moduleRoot, databasePath, useAi: false, definitions: { actions, feedbacks: {} },
  });
  assert.ok(configured.routingAliases.includes('dante'));
  assert.ok(configured.compiledAdapter.intentMappings.some((mapping) => mapping.actionId === 'setDeviceName'));
  assert.equal(configured.gates.parserMapped, true);
  assert.equal(configured.counts['parser-required'], 0);
});
