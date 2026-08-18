import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitlyNamedModule, resolveBatchModule } from '../src/module-routing.js';

test('explicit OBS batch destination overrides a stale Reaper selection', () => {
  const command = 'Create three OBS buttons: toggle streaming at 1/1/1; toggle recording at 1/1/2; set Camera 2 at 1/1/3.';
  assert.equal(resolveBatchModule(command, 'cockos-reaper'), 'obs-studio');
});

test('retains selected module when the command has no explicit destination', () => {
  assert.equal(resolveBatchModule('Create a GO button at 1/1/1', 'figure53-qlab-advance'), 'figure53-qlab-advance');
});

test('recognizes common production module names', () => {
  assert.equal(explicitlyNamedModule('Make an ATEM auto button'), 'bmd-atem');
  assert.equal(explicitlyNamedModule('Toggle DiGiCo channel 1'), 'digico-osc');
  assert.equal(explicitlyNamedModule('Send a Generic OSC message'), 'generic-osc');
  assert.equal(explicitlyNamedModule('Add a button for Axient slot 1 RF power'), 'shure-wireless');
  assert.equal(explicitlyNamedModule('Set AD4Q slot 2 high power'), 'shure-wireless');
});

test('routes names learned during third-party module onboarding', () => {
  const onboarded = [{ moduleId: 'audinate-dantecontroller', name: 'Audinate: Dante Controller' }];
  assert.equal(resolveBatchModule('make a button to set dante device name at 1.0.1', 'digico-osc', onboarded), 'audinate-dantecontroller');
});
