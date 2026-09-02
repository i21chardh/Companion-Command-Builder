import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildComEndpointPlans, comStateVariable, normalizeComAddress, normalizeComEndpointId, parseIntercomLocation } from '../src/peer-intercom.js';
import { actionDefinitions, actionManifest } from '../src/companion.js';
import { comEndpointFromPlans, nextComEndpointId, readComRegistry, registerComEndpoint, unregisterComEndpoint } from '../src/com-registry.js';

const input = {
  companionAddress: '127.0.0.1:8000',
  endpoint: {
    id: 'COM-0001', name: 'FOH', surfaceId: 'deck-a', call: '1/0/0', alarm: '1/0/1',
    actionConfig: { moduleId: 'digico-osc', connectionId: 'digico-1', command: 'channel-mute', channel: 36, answerAction: 'unmute', resetAction: 'mute' },
  },
  targetEndpoint: { id: 'COM-0002', name: 'MON' },
  answerDefinitions: [{ connectionId: 'digico-1', definitionId: 'mute', name: 'DiGiCo Channel 36 unmute', options: { channel: 36, mute: '0' } }],
  resetDefinitions: [{ connectionId: 'digico-1', definitionId: 'mute', name: 'DiGiCo Channel 36 mute', options: { channel: 36, mute: '1' } }],
};

test('builds one uniquely identified two-button Com endpoint', () => {
  const result = buildComEndpointPlans(input);
  assert.equal(result.plans.length, 2);
  assert.equal(result.endpointId, 'COM-0001');
  assert.deepEqual(result.plans.map((plan) => plan.intercom.role), ['call', 'alarm']);
  assert.equal(result.plans[0].intercom.targetEndpointId, 'COM-0002');
  assert.equal(result.plans[0].button.action.definitions[0].options.name, 'ccb_com_com_0002');
  assert.equal(result.plans[1].button.action.definitions[1].connectionId, 'digico-1');
  assert.deepEqual(result.plans[1].button.action.definitions.map((definition) => definition.step), ['0', '0', '1', '1']);
  assert.equal(result.plans[1].button.feedback.states[0].flash, true);
});

test('blank peer address defaults to the local Companion host and self-test remains deployable', () => {
  const result = buildComEndpointPlans({ ...input, companionAddress: '192.168.1.20:8000', peerAddress: '', targetEndpoint: null });
  assert.equal(result.companionAddress, '192.168.1.20:8000');
  assert.equal(result.plans[0].intercom.configurationPending, true);
  assert.match(result.plans[0].button.behavior, /self-test/i);
  assert.equal(result.plans[0].button.action.definitions[0].options.name, 'ccb_com_com_0001');
});

test('maps Com actions to Companion definitions and validates endpoint IDs', () => {
  const alarm = buildComEndpointPlans(input).plans[1];
  assert.equal(actionDefinitions(alarm.button.action)[1].connectionId, 'digico-1');
  assert.match(actionManifest(alarm.button.action)[1].summary, /Channel 36 unmute/);
  assert.equal(comStateVariable('COM-0042'), 'ccb_com_com_0042');
  assert.equal(normalizeComEndpointId('com-0042'), 'COM-0042');
  assert.equal(normalizeComAddress('http://192.168.1.20:8000/'), '192.168.1.20:8000');
  assert.deepEqual(parseIntercomLocation('2.3.4', 'Position'), { page: 2, row: 3, column: 4 });
  assert.throws(() => buildComEndpointPlans({ ...input, targetEndpoint: { id: 'COM-0001' } }), /cannot connect to itself/i);
});

test('persists endpoint IDs and exposes each pair as a future destination', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ccb-com-'));
  const path = join(directory, 'registry.json');
  assert.equal(await nextComEndpointId(path), 'COM-0001');
  const plans = buildComEndpointPlans(input).plans;
  const endpoint = comEndpointFromPlans(plans, '127.0.0.1:8000');
  await registerComEndpoint(endpoint, path);
  assert.equal(await nextComEndpointId(path), 'COM-0002');
  assert.equal((await readComRegistry(path)).endpoints[0].surfaceId, 'deck-a');
  assert.match(await readFile(path, 'utf8'), /COM-0001/);
  assert.equal(await unregisterComEndpoint('COM-0001', path), true);
  assert.equal((await readComRegistry(path)).endpoints.length, 0);
});
