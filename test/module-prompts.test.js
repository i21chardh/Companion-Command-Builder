import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_PROMPT_CORPUS, modulePromptCases } from '../src/adapters/prompt-corpus.js';

test('new-module regression corpus covers every installed target module', () => {
  assert.deepEqual(Object.keys(MODULE_PROMPT_CORPUS).sort(), [
    'bmd-atem', 'figure53-qlab-advance', 'generic-midi', 'generic-osc', 'obs-studio', 'waves-lv1',
  ]);
  for (const prompts of Object.values(MODULE_PROMPT_CORPUS)) assert.ok(prompts.length >= 8);
});

test('module prompt cases have stable unique identifiers', () => {
  const cases = modulePromptCases();
  assert.ok(cases.length >= 53);
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
});
