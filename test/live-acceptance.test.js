import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRequiredLiveConnections } from '../src/live-acceptance.js';

const instance = (modelID) => ({ id: 'shure', value: JSON.stringify({ moduleInstanceType: 'connection', moduleId: 'shure-wireless', moduleVersionId: '2.3.1', label: 'shure-wx', enabled: true, config: { modelID } }) });

test('the required Axient workflow fails the release gate for a ULXD connection', () => {
  const report = auditRequiredLiveConnections([instance('ulxd4')]);
  assert.equal(report.gate, 'FAIL');
  assert.equal(report.results[0].status, 'fail');
  assert.match(report.results[0].reason, /AD4D or AD4Q/);
});

test('the required Axient workflow advances only an Axient connection to live read-back', () => {
  for (const model of ['ad4d', 'ad4q']) {
    const report = auditRequiredLiveConnections([instance(model)]);
    assert.equal(report.gate, 'READY-FOR-LIVE-READBACK');
    assert.equal(report.results[0].configuredModel, model);
  }
});

test('the required Axient workflow passes only after the exact Companion action is stored', () => {
  const connection = instance('ad4q');
  const wrongControl = [{ id: 'bank:wrong', value: JSON.stringify({ connectionId: 'shure', definitionId: 'channel_mute' }) }];
  assert.equal(auditRequiredLiveConnections([connection], undefined, wrongControl).gate, 'READY-FOR-LIVE-READBACK');
  const exactControl = [{ id: 'bank:axient', value: JSON.stringify({ steps: { 0: { action_sets: { down: [{ connectionId: 'shure', definitionId: 'slot_rf_power', options: { slot: '1:1', power: 'NORMAL' } }] } } } }) }];
  const report = auditRequiredLiveConnections([connection], undefined, exactControl);
  assert.equal(report.gate, 'PASS');
  assert.equal(report.results[0].status, 'passed');
  assert.equal(report.results[0].controlId, 'bank:axient');
});
