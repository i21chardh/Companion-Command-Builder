import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDefaultLocation, commandHasLocation, duplicateLocations, expandLayoutCommand, splitBatchCommands } from '../src/batch.js';

test('splits newline, numbered, bullet, and semicolon batch commands', () => {
  assert.deepEqual(splitBatchCommands('1. fire snapshot 1 on 1/1/1\n- fire macro 2 on 1/1/2; mute channel 3 on 1/1/3'), [
    'fire snapshot 1 on 1/1/1', 'fire macro 2 on 1/1/2', 'mute channel 3 on 1/1/3',
  ]);
});

test('expands a three-button REAPER transport row into Play, Stop, and Record', () => {
  assert.deepEqual(expandLayoutCommand('create 3 different buttons next to each other from 1.3.1 to 1.3.3 for the reaper transport controls', 'cockos-reaper'), [
    'Create a REAPER play button labeled "PLAY" at 1/3/1',
    'Create a REAPER stop button labeled "STOP" at 1/3/2',
    'Create a REAPER record button labeled "RECORD" at 1/3/3',
  ]);
});

test('accepts compact native-zero REAPER ranges and ignores an extra available endpoint', () => {
  assert.deepEqual(expandLayoutCommand('create 3 buttons at 1.0.0-1.0.3 for reaper transport controls', 'cockos-reaper'), [
    'Create a REAPER play button labeled "PLAY" at 1/0/0',
    'Create a REAPER stop button labeled "STOP" at 1/0/1',
    'Create a REAPER record button labeled "RECORD" at 1/0/2',
  ]);
});

test('expands a terse REAPER transport anchor into three adjacent controls', () => {
  assert.deepEqual(expandLayoutCommand('create reaper transport controls at 1.1.4"', 'cockos-reaper'), [
    'Create a REAPER play button labeled "PLAY" at 1/1/4',
    'Create a REAPER stop button labeled "STOP" at 1/1/5',
    'Create a REAPER record button labeled "RECORD" at 1/1/6',
  ]);
});

test('finds duplicate PAGE/ROW/COLUMN locations', () => {
  const plan = (page, row, column) => ({ button: { location: { page, row, column } } });
  assert.deepEqual(duplicateLocations([plan(1, 1, 1), plan(1, 1, 2), plan(1, 1, 1)]), ['1/1/1']);
});

test('expands Shure gain and frequency readouts into two deterministic buttons', () => {
  assert.deepEqual(expandLayoutCommand('create 2 buttons at 1.1.1 and 1.2.1 that show selected channel gain and frequency for shure', 'shure-wireless'), [
    'Create a Shure channel 1 gain display labeled "CH 1 GAIN" at 1/1/1',
    'Create a Shure channel 1 frequency display labeled "CH 1 FREQ" at 1/2/1',
  ]);
});

test('applies a first-open fallback only when a creation command omits its location', () => {
  assert.equal(applyDefaultLocation('Create a Shure channel 1 gain display', { page: 2, row: 0, column: 3 }), 'Create a Shure channel 1 gain display at 2/0/3');
  assert.equal(applyDefaultLocation('Create a mute at one dot two dot three', { page: 9, row: 9, column: 9 }), 'Create a mute at one dot two dot three');
  assert.equal(commandHasLocation('Create a button at 1.2.3'), true);
  assert.equal(commandHasLocation('Create a button without a position'), false);
});

test('splits positional follow-up clauses in a multi-button request', () => {
  assert.deepEqual(splitBatchCommands('Create OBS at 1/1/1; at 1/1/2 create REC; at 1/1/3 create CAM 2'), [
    'Create OBS at 1/1/1', 'at 1/1/2 create REC', 'at 1/1/3 create CAM 2',
  ]);
});
