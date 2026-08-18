import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretKnownDynamicCommand } from '../src/deterministic-dynamic.js';
import { provisionalAdapter } from '../src/adapters/provisional.js';

const reaperAdapter = provisionalAdapter('cockos-reaper');

test('maps the three-button OBS test without invoking a model', () => {
  const adapter = provisionalAdapter('obs-studio');
  const stream = interpretKnownDynamicCommand('at 1/1/1 create a red button labeled "LIVE" that toggles streaming', adapter);
  const record = interpretKnownDynamicCommand('at 1/1/2 create a button labeled "REC" that toggles recording', adapter);
  const scene = interpretKnownDynamicCommand('at 1/1/3 create a blue button labeled "CAM 2" that changes the program scene to Camera 2.', adapter);
  assert.equal(stream.actionId, 'StartStopStreaming');
  assert.equal(stream.backgroundColor, '#ff0000');
  assert.equal(record.actionId, 'StartStopRecording');
  assert.equal(scene.actionId, 'set_scene');
  assert.deepEqual(scene.options, { scene: 'customSceneName', customSceneName: 'Camera 2' });
});

test('maps core REAPER transport controls without asking the model to create buttons', () => {
  assert.equal(interpretKnownDynamicCommand('Create a REAPER play button labeled "PLAY" at 1/3/1', reaperAdapter).actionId, 'play');
  assert.equal(interpretKnownDynamicCommand('Create a REAPER stop button labeled "STOP" at 1/3/2', reaperAdapter).actionId, 'stop');
  assert.equal(interpretKnownDynamicCommand('Create a REAPER record button labeled "RECORD" at 1/3/3', reaperAdapter).actionId, 'record');
});

test('maps common QLab controls without a model', () => {
  const adapter = provisionalAdapter('figure53-qlab-advance');
  assert.equal(interpretKnownDynamicCommand('Create a QLab GO button at 2/1/1 to fire the next cue', adapter).actionId, 'go');
  assert.equal(interpretKnownDynamicCommand('Create a red PANIC button at 2/1/2 to stop all cues', adapter).actionId, 'panic');
  assert.equal(interpretKnownDynamicCommand('put a green "GO" button at 2/1/1 that fires the next cue', adapter).actionId, 'go');
  assert.equal(interpretKnownDynamicCommand('put a red "PANIC" button at 2/1/3 that stops all running cues', adapter).actionId, 'panic');
});

test('maps Axient slot RF actions without Ollama or the DiGiCo parser', () => {
  const adapter = provisionalAdapter('shure-wireless');
  const power = interpretKnownDynamicCommand('add a button at 1.0.3 for axient slot 1 rf power', adapter);
  assert.equal(power.actionId, 'slot_rf_power');
  assert.deepEqual(power.options, { slot: '1:1', power: 'NORMAL' });
  assert.deepEqual([power.page, power.row, power.column], [1, 0, 3]);
  const high = interpretKnownDynamicCommand('Create an Axient channel 2 slot 4 high RF power button at 2/1/3', adapter);
  assert.deepEqual(high.options, { slot: '2:4', power: 'HIGH' });
});

test('maps Shure live gain and frequency readouts without treating them as control actions', () => {
  const adapter = provisionalAdapter('shure-wireless');
  const gain = interpretKnownDynamicCommand('Create a Shure channel 1 gain display labeled "CH 1 GAIN" at 1/1/1', adapter);
  const frequency = interpretKnownDynamicCommand('Create a Shure channel 3 frequency display labeled "CH 3 FREQ" at 1/2/1', adapter);
  assert.deepEqual({ variable: gain.displayVariable, metric: gain.displayMetric, channel: gain.channel }, { variable: 'ch_1_audio_gain', metric: 'gain', channel: 1 });
  assert.deepEqual({ variable: frequency.displayVariable, metric: frequency.displayMetric, channel: frequency.channel }, { variable: 'ch_3_frequency', metric: 'frequency', channel: 3 });
});

test('maps an onboarded Dante action from its compiled live action name without Ollama', () => {
  const adapter = {
    moduleId: 'audinate-dantecontroller', version: '1.1.2', name: 'Audinate: Dante Controller',
    actions: [
      { id: 'setDeviceName', name: 'setDeviceName', options: [{ id: 'name', type: 'textinput', label: 'New name', default: '' }] },
      { id: 'setDeviceNameCustom', name: 'setDeviceNameCustom', options: [] },
      { id: 'resetDeviceName', name: 'resetDeviceName', options: [] },
    ],
  };
  const result = interpretKnownDynamicCommand('make a button to set dante device name at 1.0.1', adapter);
  assert.equal(result.actionId, 'setDeviceName');
  assert.deepEqual([result.page, result.row, result.column], [1, 0, 1]);
});
