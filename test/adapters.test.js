import test from 'node:test';
import assert from 'node:assert/strict';
import { adapterDevelopmentQueue, buildConnectionRegistry, isAudioConsoleModule } from '../src/adapters/index.js';

test('marks a matching DiGiCo module as verified and supported', () => {
  const [entry] = buildConnectionRegistry([{ id: 'abc', label: 'Console', moduleId: 'digico-osc', moduleVersionId: '1.0.4', enabled: true }]);
  assert.equal(entry.adapter.status, 'supported');
  assert.equal(entry.adapter.verification, 'verified');
  assert.ok(entry.adapter.capabilities.includes('Macros'));
  assert.ok(entry.adapter.graphics.some((graphic) => graphic.label === 'Talkback / TB'));
});

test('retains unknown modules as discovered registry entries', () => {
  const [entry] = buildConnectionRegistry([{ id: 'xyz', label: 'Future module', moduleId: 'future-device', moduleVersionId: '2.0.0', enabled: true }]);
  assert.equal(entry.adapter.status, 'discovered');
  assert.equal(entry.adapter.compatible, false);
  assert.deepEqual(entry.adapter.graphics, []);
});

test('reports adapter version mismatches without claiming compatibility', () => {
  const [entry] = buildConnectionRegistry([{ id: 'abc', label: 'Console', moduleId: 'digico-osc', moduleVersionId: '1.1.0', enabled: true }]);
  assert.equal(entry.adapter.status, 'version-mismatch');
  assert.equal(entry.adapter.compatible, false);
  assert.deepEqual(entry.adapter.supportedVersions, ['1.0.4']);
});

test('maps the documented Shure Wireless 2.3.1 baseline', () => {
  const [entry] = buildConnectionRegistry([{ id: 'shure', label: 'Wireless Rack', moduleId: 'shure-wireless', moduleVersionId: '2.3.1', enabled: true }]);
  assert.equal(entry.adapter.status, 'supported');
  assert.equal(entry.adapter.verification, 'documented');
  assert.ok(entry.adapter.capabilities.includes('Channel gain'));
  assert.ok(entry.adapter.graphics.some((graphic) => graphic.label === 'Battery'));
});

test('keeps the requested adapter onboarding priorities in order', () => {
  const queue = adapterDevelopmentQueue();
  assert.deepEqual(queue.slice(0, 4).map((entry) => entry.moduleId), [
    'shure-wireless', 'figure53-qlab-advance', 'bmd-atem', 'obs-studio',
  ]);
  assert.ok(queue.some((entry) => entry.moduleId === 'generic-midi'));
  assert.ok(queue.some((entry) => entry.moduleId === 'generic-osc'));
});

test('recognizes audio-console manifests from Companion metadata', () => {
  assert.equal(isAudioConsoleModule({ id: 'vendor-desk', keywords: ['digital mixer'] }), true);
  assert.equal(isAudioConsoleModule({ id: 'obs-studio', description: 'Video production' }), false);
});
