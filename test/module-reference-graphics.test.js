import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDefaultModuleGraphic, moduleReferenceGraphic } from '../src/module-reference-graphics.js';

test('assigns recognizable module reference marks to newly created buttons', () => {
  assert.equal(moduleReferenceGraphic('spotify-remote').symbol, 'SPOT');
  assert.equal(moduleReferenceGraphic('waves-lv1').symbol, 'LV1');
  assert.equal(moduleReferenceGraphic('digico-osc').symbol, 'DGO');
  const plan = { kind: 'create-button', module: { id: 'spotify-remote' }, button: { text: 'NEXT TRACK' } };
  applyDefaultModuleGraphic(plan);
  assert.equal(plan.button.text, 'NEXT TRACK');
  assert.equal(plan.button.graphic.kind, 'module-reference');
  assert.equal(plan.button.graphic.placement, 'upper-right');
});

test('never overrides a user-selected graphic or modifies an existing-button edit', () => {
  const selected = { kind: 'create-button', module: { id: 'spotify-remote' }, button: { text: '▶\nPLAY', graphic: { id: 'user', symbol: '▶' } } };
  applyDefaultModuleGraphic(selected);
  assert.equal(selected.button.text, '▶\nPLAY');
  assert.equal(selected.button.graphic.id, 'user');
  const edit = { kind: 'replace-button', module: { id: 'spotify-remote' }, button: { text: 'PLAY' } };
  applyDefaultModuleGraphic(edit);
  assert.equal(edit.button.text, 'PLAY');
  assert.equal(edit.button.graphic, undefined);
});

test('does not duplicate a module mark used as the complete display label', () => {
  const display = { kind: 'create-button', module: { id: 'cockos-reaper' }, button: { text: 'REAPER' } };
  applyDefaultModuleGraphic(display);
  assert.equal(display.button.text, 'REAPER');
});
