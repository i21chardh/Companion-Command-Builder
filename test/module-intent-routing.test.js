import test from 'node:test';
import assert from 'node:assert/strict';
import { deterministicModuleCandidates } from '../src/module-intent-routing.js';
import { provisionalAdapter } from '../src/adapters/provisional.js';

const dante = {
  moduleId: 'audinate-dantecontroller', version: '1.1.2', name: 'Audinate: Dante Controller',
  actions: [{ id: 'setDeviceName', name: 'setDeviceName', options: [] }],
};

test('evaluates an onboarded Dante module and DiGiCo as equal deterministic candidates', () => {
  const candidates = deterministicModuleCandidates('make a button to set dante device name at 1.0.1', [
    { moduleId: 'digico-osc', adapter: null },
    { moduleId: 'audinate-dantecontroller', adapter: dante },
  ]);
  assert.deepEqual(candidates, ['audinate-dantecontroller']);
});

test('returns neutral ambiguity when multiple enabled modules support the same language', () => {
  const candidates = deterministicModuleCandidates('toggle mute channel 3 at 1.0.1', [
    { moduleId: 'digico-osc', adapter: null },
    { moduleId: 'shure-wireless', adapter: provisionalAdapter('shure-wireless') },
  ]);
  assert.deepEqual(candidates.sort(), ['digico-osc', 'shure-wireless']);
});

test('does not assign an unrelated request to any module', () => {
  assert.deepEqual(deterministicModuleCandidates('make a button that does something at 1.0.1', [
    { moduleId: 'digico-osc', adapter: null },
    { moduleId: 'audinate-dantecontroller', adapter: dante },
  ]), []);
});
