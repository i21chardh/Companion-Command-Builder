import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { languageExamples, rememberSuccessfulCommand } from '../src/language-memory.js';

test('ranks repeated and corrected local language examples without crossing modules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-language-memory-'));
  const path = join(root, 'memory.json');
  await rememberSuccessfulCommand({ command: 'take camera one', moduleId: 'obs-studio', actionId: 'setScene' }, path);
  await rememberSuccessfulCommand({ command: 'take camera one', moduleId: 'obs-studio', actionId: 'setScene' }, path);
  await rememberSuccessfulCommand({ command: 'take camera one', moduleId: 'bmd-atem', actionId: 'cut', corrected: true }, path);
  const obs = await languageExamples('take camera two', 'obs-studio', 5, path);
  assert.equal(obs[0].moduleId, 'obs-studio');
  assert.equal(obs[0].count, 2);
  assert.ok(obs.every((item) => item.moduleId !== 'bmd-atem'));
});

test('normalizes changing numbers into one frequently used phrase', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ccb-language-numbers-'));
  const path = join(root, 'memory.json');
  await rememberSuccessfulCommand({ command: 'mute channel 3 at 1/1/1', moduleId: 'digico-osc', actionId: 'mute' }, path);
  const result = await rememberSuccessfulCommand({ command: 'mute channel 8 at 2/2/2', moduleId: 'digico-osc', actionId: 'mute' }, path);
  assert.equal(result.count, 2);
});
