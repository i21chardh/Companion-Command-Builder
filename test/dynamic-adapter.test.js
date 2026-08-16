import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDynamicPlan, compileDynamicAdapter, validateDynamicAction, validateDynamicPlanAvailability } from '../src/adapters/dynamic.js';
import { provisionalAdapter } from '../src/adapters/provisional.js';
import { actionDefinitions, actionManifest, resolvedButtonText } from '../src/companion.js';

const adapter = compileDynamicAdapter(
  { moduleId: 'test-video', version: '1.0.0', name: 'Test Video' },
  { actions: { cut: { name: 'Cut input', options: [
    { id: 'input', type: 'number', label: 'Input', min: 1, max: 8, required: true },
    { id: 'preview', type: 'checkbox', label: 'Preview', default: false },
  ] } }, feedbacks: {} },
);

test('compiles and strictly validates a live Companion action schema', () => {
  assert.equal(adapter.actions[0].id, 'cut');
  assert.deepEqual(validateDynamicAction(adapter, { actionId: 'cut', options: { input: 3 } }).options, { input: 3, preview: false });
  assert.throws(() => validateDynamicAction(adapter, { actionId: 'cut', options: { input: 9 } }), /no more than 8/);
  assert.throws(() => validateDynamicAction(adapter, { actionId: 'invented', options: {} }), /not in the live/);
  assert.throws(() => validateDynamicAction(adapter, { actionId: 'cut', options: { input: 2, fake: true } }), /not valid/);
});

test('provides installed-version OBS and QLab generation baselines before host validation', () => {
  const obs = provisionalAdapter('obs-studio');
  const qlab = provisionalAdapter('figure53-qlab-advance');
  assert.equal(obs.provisional, true);
  assert.ok(obs.actions.some((item) => item.id === 'StartStopRecording'));
  assert.ok(obs.actions.some((item) => item.id === 'set_scene'));
  assert.ok(qlab.actions.some((item) => item.id === 'go'));
  const plan = buildDynamicPlan(obs, { recognized: true, actionId: 'StartStopStreaming', options: {}, page: 1, row: 1, column: 1, label: 'LIVE' }, { product: 'Companion' });
  assert.match(plan.deployment.reason, /installed module version baseline/i);
});

test('builds a deployable dynamic plan without inventing schema fields', () => {
  const plan = buildDynamicPlan(adapter, { actionId: 'cut', options: { input: 4 }, page: 1, row: 2, column: 3, label: 'CAM 4', sourceText: 'cut cam 4 at 1/2/3' }, { product: 'Companion', version: '5.0.3', address: 'http://127.0.0.1:8000' });
  assert.equal(plan.button.action.family, 'dynamic');
  assert.deepEqual(actionDefinitions(plan.button.action), [{ definitionId: 'cut', options: { input: 4, preview: false } }]);
  assert.equal(actionManifest(plan.button.action)[0].summary, 'Run Cut input');
});

test('rejects Axient slot actions when the live Shure connection is configured as ULX-D', () => {
  const plan = {
    module: { id: 'shure-wireless', version: '2.3.1' },
    button: { action: { family: 'dynamic', definitions: [{ definitionId: 'slot_rf_power', options: { slot: '1:1', power: 'NORMAL' } }] } },
  };
  assert.throws(
    () => validateDynamicPlanAvailability(plan, { actions: { channel_mute: {} } }, { label: 'shure-wx' }),
    /choose the actual Axient AD4D or AD4Q receiver model/,
  );
  assert.equal(validateDynamicPlanAvailability(plan, { actions: { slot_rf_power: {} } }, { label: 'shure-wx' }), true);
});

test('builds Shure live-variable display buttons with no press action', () => {
  const shure = provisionalAdapter('shure-wireless');
  const interpretation = {
    recognized: true, displayVariable: 'ch_1_audio_gain', displayMetric: 'gain', channel: 1,
    page: 1, row: 1, column: 1, label: 'CH 1 GAIN', sourceText: 'show channel 1 gain at 1/1/1',
  };
  const plan = buildDynamicPlan(shure, interpretation, { product: 'Companion' });
  assert.equal(plan.button.action.family, 'variable-display');
  assert.deepEqual(actionDefinitions(plan.button.action), []);
  assert.match(actionManifest(plan.button.action)[0].summary, /channel 1 audio gain/i);
  assert.equal(resolvedButtonText(plan, 'shure-wx'), 'GAIN\n$(shure-wx:ch_1_audio_gain)');
});
