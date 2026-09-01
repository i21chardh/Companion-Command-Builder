import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPeerIntercomPlans, parseIntercomLocation } from '../src/peer-intercom.js';
import { actionDefinitions, actionManifest } from '../src/companion.js';

const input = {
  name: 'FOH MON',
  peerA: { name: 'FOH', surfaceId: 'deck-a', call: '1/0/0', answer: '1/0/1', end: '1/0/2', talkOn: '2/1/0', talkOff: '2/1/1' },
  peerB: { name: 'MON', surfaceId: 'deck-b', call: '1.0.0', answer: '1.0.1', end: '1.0.2', listenOn: '2/2/0', listenOff: '2/2/1' },
};

test('builds a six-button two-surface peer intercom workflow', () => {
  const result = buildPeerIntercomPlans(input);
  assert.equal(result.plans.length, 6);
  assert.equal(result.stateVariable, 'custom:ccb_intercom_foh_mon');
  assert.deepEqual([...new Set(result.plans.map((plan) => plan.targetSurfaceId))], ['deck-a', 'deck-b']);
  assert.deepEqual(result.plans.map((plan) => plan.intercom.role), ['call-peer-b', 'answer-peer-b', 'end-peer-b', 'call-peer-a', 'answer-peer-a', 'end-peer-a']);
  assert.equal(result.plans[0].button.action.definitions[0].definitionId, 'custom_variable_set_value');
  assert.equal(result.plans[0].button.action.definitions[1].options.location, '2/1/0');
  assert.equal(result.plans[4].button.action.definitions[1].options.location, '2/2/0');
});

test('maps intercom plans to Companion internal actions and readable summaries', () => {
  const call = buildPeerIntercomPlans(input).plans[0];
  assert.deepEqual(actionDefinitions(call.button.action).map((item) => item.definitionId), ['custom_variable_set_value', 'button_pressrelease']);
  assert.match(actionManifest(call.button.action)[0].summary, /a_calling_b/);
  assert.equal(call.button.feedback.family, 'peer-intercom-state');
});

test('accepts slash and dot coordinates and rejects unsafe workflow collisions', () => {
  assert.deepEqual(parseIntercomLocation('2.3.4', 'Position'), { page: 2, row: 3, column: 4 });
  assert.throws(() => parseIntercomLocation('row 3', 'Position'), /PAGE\/ROW\/COLUMN/);
  assert.throws(() => buildPeerIntercomPlans({ ...input, peerA: { ...input.peerA, answer: input.peerA.call } }), /overlap/);
  assert.throws(() => buildPeerIntercomPlans({ ...input, peerB: { ...input.peerB, surfaceId: 'deck-a' } }), /two different/);
});
