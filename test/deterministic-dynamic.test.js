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

test('prefers the contiguous onboarded action phrase over boilerplate button words', () => {
  const adapter = {
    moduleId: 'audiostrom-liveprofessor', version: '1.0.0', name: 'Audioström: LiveProfessor',
    actions: [
      { id: 'GenericCommand', name: 'GenericCommand', options: [] },
      { id: 'GenericButton', name: 'GenericButton', options: [] },
    ],
  };
  const result = interpretKnownDynamicCommand('Create a Audioström: LiveProfessor button at 1/1/1 to Generic Command', adapter);
  assert.equal(result.actionId, 'GenericCommand');
});

test('maps the real LV1 1.1.0 channel mute language and options without AI', () => {
  const adapter = {
    moduleId: 'waves-lv1', version: '1.1.0', name: 'Waves Audio: LV1',
    actions: [{ id: 'mute', name: 'Channel: Mute / Unmute / Toggle', options: [] }],
  };
  const mute = interpretKnownDynamicCommand('Create a button on 1.1.0 to mute channel 16 on lv1', adapter);
  assert.equal(mute.actionId, 'mute');
  assert.deepEqual(mute.options, { group: 0, ch_in: 16, state: 'on' });
  assert.deepEqual([mute.page, mute.row, mute.column], [1, 1, 0]);
  const toggle = interpretKnownDynamicCommand('Create an LV1 toggle mute for input 8 at 2/1/3', adapter);
  assert.deepEqual(toggle.options, { group: 0, ch_in: 8, state: 'toggle' });
});

test('maps LV1 fader shorthand and explicit levels without AI', () => {
  const adapter = {
    moduleId: 'waves-lv1', version: '1.1.0', name: 'Waves Audio: LV1',
    actions: [{ id: 'outGain', name: 'Channel: Set output fader (dB)', options: [] }],
  };
  const mapped = interpretKnownDynamicCommand('map 1.3.1 to Lv1 fader 45', adapter);
  assert.equal(mapped.actionId, 'outGain');
  assert.deepEqual(mapped.options, { group: 0, ch_in: 45, db: '0' });
  assert.equal(mapped.label, 'LV1 FADER 45');
  assert.deepEqual([mapped.page, mapped.row, mapped.column], [1, 3, 1]);
  const leveled = interpretKnownDynamicCommand('Set LV1 input fader 8 to -6 dB at 2/1/3', adapter);
  assert.deepEqual(leveled.options, { group: 0, ch_in: 8, db: '-6' });
});

test('handles LV1 monitor-send language deterministically and rejects unsupported rotary mapping early', () => {
  const adapter = {
    moduleId: 'waves-lv1', version: '1.1.0', name: 'Waves Audio: LV1',
    actions: [{ id: 'sendGain', name: 'Send: Set fader (dB)', options: [] }],
  };
  assert.throws(
    () => interpretKnownDynamicCommand('map rotory encoder 1.3.0 to Lv1 mon send 16', adapter),
    /requires an input channel/,
  );
  assert.throws(
    () => interpretKnownDynamicCommand('map rotory encoder 1.3.0 to Lv1 ch 45 mon send 16', adapter),
    /Install the CCB LV1 1\.1\.2 module/,
  );
  const absolute = interpretKnownDynamicCommand('Set LV1 channel 45 monitor send 16 to -10 dB at 1.3.0', adapter);
  assert.equal(absolute.actionId, 'sendGain');
  assert.deepEqual(absolute.options, { inputCh: 45, aux: 24, db: '-10' });
  assert.deepEqual([absolute.page, absolute.row, absolute.column], [1, 3, 0]);
});

test('maps GainStage-style LV1 monitor sends onto Companion rotary action sets', () => {
  const adapter = {
    moduleId: 'waves-lv1', version: '1.1.1', name: 'Waves Audio: LV1',
    actions: [{ id: 'sendGainRelative', name: 'Send: Adjust fader relative (dB)', options: [] }],
  };
  const mapped = interpretKnownDynamicCommand('map rotary encoder 1.3.0 to LV1 ch 45 mon send 16 in 0.5 dB steps', adapter);
  assert.equal(mapped.rotary, true);
  assert.deepEqual(mapped.actionSets, {
      rotate_left: { actionId: 'sendGainRelative', options: { inputCh: 45, aux: 24, delta: -0.5 } },
      rotate_right: { actionId: 'sendGainRelative', options: { inputCh: 45, aux: 24, delta: 0.5 } },
  });
  assert.equal(mapped.label, 'CH 45\nMON 16');
});

test('maps Spotify stop language to Pause Playback without Ollama', () => {
  const adapter = {
    moduleId: 'spotify-remote', version: '2.6.0', name: 'Spotify: Web API and Controller',
    actions: [{ id: 'pause', name: 'Pause Playback', options: [] }],
  };
  const mapped = interpretKnownDynamicCommand('create a spotify stop button at 1.1.1 thats the same style button as 1.1.0', adapter);
  assert.equal(mapped.actionId, 'pause');
  assert.equal(mapped.label, 'STOP');
  assert.deepEqual([mapped.page, mapped.row, mapped.column], [1, 1, 1]);
});

test('maps an existing-button Spotify play/pause request without DiGiCo assumptions', () => {
  const adapter = {
    moduleId: 'spotify-remote', version: '2.6.0', name: 'Spotify: Web API and Controller',
    actions: [{ id: 'play/pause', name: 'Toggle Play/Pause', options: [] }],
  };
  const mapped = interpretKnownDynamicCommand('update button at 1.1.0 to be a spotify toggle play/pause', adapter);
  assert.equal(mapped.actionId, 'play/pause');
  assert.deepEqual([mapped.page, mapped.row, mapped.column], [1, 1, 0]);
});

test('maps natural Spotify next-track language to the live skip action', () => {
  const adapter = {
    moduleId: 'spotify-remote', version: '2.6.0', name: 'Spotify: Web API and Controller',
    actions: [{ id: 'skip', name: 'Skip Track', options: [] }],
  };
  const mapped = interpretKnownDynamicCommand('create a button at 1.1.1 to be a spotify next track button', adapter);
  assert.equal(mapped.actionId, 'skip');
  assert.equal(mapped.label, 'NEXT TRACK');
  assert.deepEqual([mapped.page, mapped.row, mapped.column], [1, 1, 1]);
});

test('maps Spotify back language to the live previous action', () => {
  const adapter = {
    moduleId: 'spotify-remote', version: '2.6.0', name: 'Spotify: Web API and Controller',
    actions: [{ id: 'previous', name: 'Previous Track', options: [] }],
  };
  const mapped = interpretKnownDynamicCommand('create a spotify back button at 1.1.2', adapter);
  assert.equal(mapped.actionId, 'previous');
  assert.equal(mapped.label, 'PREVIOUS');
});

test('maps a REAPER transport-time display without a press action', () => {
  const adapter = { moduleId: 'cockos-reaper', version: '2.5.0', name: 'Cockos: REAPER', actions: [] };
  const mapped = interpretKnownDynamicCommand('show REAPER transport time at 1.1.2', adapter);
  assert.equal(mapped.displayVariable, 'time');
  assert.equal(mapped.displayPrefix, 'REAPER');
  assert.deepEqual([mapped.page, mapped.row, mapped.column], [1, 1, 2]);
});
