import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig } from '../src/config.js';
import { parseCommand } from '../src/parser.js';
import { buildDeploymentPlan } from '../src/plan.js';

test('builds a safe DiGiCo deployment plan', () => {
  const plan = buildDeploymentPlan({
    kind: 'create-button',
    location: { page: 1, row: 3, column: 1 },
    action: { operation: 'mute', channel: 36 },
    sourceText: 'test',
  }, defaultConfig);

  assert.equal(plan.kind, 'create-button');
  assert.equal(plan.button.text, 'CH 36\nMUTE');
  assert.deepEqual(plan.button.action.channels, [36]);
  assert.equal(plan.button.action.desiredValue, true);
  assert.equal(plan.safety.overwriteExisting, false);
  assert.equal(plan.deployment.status, 'ready');
});

test('builds a styled multi-channel toggle plan', () => {
  const plan = buildDeploymentPlan({
    kind: 'create-button',
    location: { page: 1, row: 2, column: 3 },
    action: { operation: 'toggle-mute', channels: [1, 3, 7, 11] },
    appearance: { label: 'TB Mute', textColor: '#ff0000', backgroundColor: '#000000' },
    sourceText: 'test',
  }, defaultConfig);
  assert.equal(plan.button.text, 'TB Mute');
  assert.deepEqual(plan.button.action.channels, [1, 3, 7, 11]);
  assert.deepEqual(plan.button.appearance, { textColor: '#ff0000', backgroundColor: '#000000' });
});

test('builds state-specific toggle appearance using unmuted as the base', () => {
  const parsed = parseCommand('Create a toggle mute button labeled "Band TB" for channels 2 through 4 on 1/2/4 with a blue font and black background when unmuted and white font with red background when muted');
  const plan = buildDeploymentPlan(parsed, defaultConfig);
  assert.equal(plan.button.appearance.textColor, '#0000ff');
  assert.equal(plan.button.appearance.backgroundColor, '#000000');
  assert.deepEqual(plan.button.appearance.states.muted, { textColor: '#ffffff', backgroundColor: '#ff0000' });
  assert.equal(plan.button.stateFeedback.mutedStep, 2);
});

test('builds an inverted visual toggle for a DiGiCo macro', () => {
  const plan = buildDeploymentPlan(parseCommand('create a blue and green toggle button that fires digico macro 1 and inverts colors when pressed in 1.2.3'), defaultConfig);
  assert.deepEqual(plan.button.appearance.states.unmuted, { textColor: '#0000ff', backgroundColor: '#008000' });
  assert.deepEqual(plan.button.appearance.states.muted, { textColor: '#008000', backgroundColor: '#0000ff' });
  assert.equal(plan.button.stateFeedback.mutedStep, 2);
});

test('rejects channels outside the digico_osc range', () => {
  assert.throws(() => buildDeploymentPlan({
    kind: 'create-button',
    location: { page: 1, row: 1, column: 1 },
    action: { operation: 'mute', channels: [145] },
    sourceText: 'test',
  }, defaultConfig), /1 through 144/);
});

test('builds a channel-fader deployment plan', () => {
  const plan = buildDeploymentPlan({
    kind: 'create-button', location: { page: 2, row: 1, column: 1 },
    action: { family: 'channel-fader', operation: 'set-fader', channels: [36], levelDb: 0 }, sourceText: 'test',
  }, defaultConfig);
  assert.equal(plan.button.text, 'CH 36\n0 dB');
  assert.deepEqual(plan.button.action, { family: 'channel-fader', operation: 'set-fader', channels: [36], levelDb: 0 });
  assert.equal(plan.button.feedback, null);
});

test('builds and validates an aux-mute deployment plan', () => {
  const plan = buildDeploymentPlan({
    kind: 'create-button', location: { page: 3, row: 1, column: 3 },
    action: { family: 'aux-mute', operation: 'toggle-mute', auxes: [1, 2, 3] }, sourceText: 'test',
  }, defaultConfig);
  assert.equal(plan.button.text, 'AUX 1, 2, 3\nTOGGLE');
  assert.deepEqual(plan.button.action, { family: 'aux-mute', operation: 'toggle-mute', auxes: [1, 2, 3], desiredValue: null });
  assert.equal(plan.button.feedback, null);
  assert.throws(() => buildDeploymentPlan({
    kind: 'create-button', location: { page: 1, row: 1, column: 1 },
    action: { family: 'aux-mute', operation: 'mute', auxes: [13] }, sourceText: 'test',
  }, defaultConfig), /1 through 12/);
});

test('builds and validates a control-group mute deployment plan', () => {
  const plan = buildDeploymentPlan({
    kind: 'create-button', location: { page: 3, row: 2, column: 4 },
    action: { family: 'control-group-mute', operation: 'mute', controlGroups: [1, 2, 3, 4] }, sourceText: 'test',
  }, defaultConfig);
  assert.equal(plan.button.text, 'CG 1, 2, 3, 4\nMUTE');
  assert.deepEqual(plan.button.action.controlGroups, [1, 2, 3, 4]);
  assert.equal(plan.button.feedback, null);
  assert.throws(() => buildDeploymentPlan({
    kind: 'create-button', location: { page: 1, row: 1, column: 1 },
    action: { family: 'control-group-mute', operation: 'mute', controlGroups: [25] }, sourceText: 'test',
  }, defaultConfig), /1 through 24/);
});

test('builds a Generic MIDI preview plan from natural language', () => {
  const plan = buildDeploymentPlan(parseCommand('Send MIDI CC 7 value 100 on channel 2 at 9/1/3 labeled FOH LEVEL.'), defaultConfig);
  assert.equal(plan.module.id, 'generic-midi');
  assert.equal(plan.module.version, '1.4.0');
  assert.equal(plan.button.text, 'FOH LEVEL');
  assert.match(plan.button.behavior, /controller 7 · value 100/);
});

test('builds a momentary MIDI CC press/release plan without AI', () => {
  const plan = buildDeploymentPlan(parseCommand('make a momentary on/off button with Ch1 midi CC 12, and Ch1 Midi CC 14 on release at 1.2.3'), defaultConfig);
  assert.deepEqual(plan.button.location, { page: 1, row: 2, column: 3 });
  assert.equal(plan.button.action.operation, 'momentary-cc');
  assert.match(plan.button.behavior, /press channel 1 controller 12 value 127 · release controller 14 value 0/);
});

test('builds a guarded direct-transport plan for DiGiCo inserts', () => {
  const plan = buildDeploymentPlan(parseCommand('Toggle insert B for channels 17 and 18 at 2/1/4'), defaultConfig);
  assert.equal(plan.button.action.family, 'channel-insert');
  assert.equal(plan.button.action.transport, 'digico-pad');
  assert.equal(plan.deployment.status, 'hardware-validation-required');
  assert.equal(plan.button.feedback.capabilities[0].id, 'channel.insertB.enabled');
});
