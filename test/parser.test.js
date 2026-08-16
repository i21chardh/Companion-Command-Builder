import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, CommandParseError } from '../src/parser.js';

test('parses the initial acceptance command', () => {
  const result = parseCommand('create a button in column 1 row 3 that will mute channel number 36');
  assert.deepEqual(result.location, { page: 1, row: 3, column: 1 });
  assert.deepEqual(result.action, { family: 'channel-mute', operation: 'mute', channel: 36 });
});

test('parses explicit pages and common channel aliases', () => {
  const result = parseCommand('On page 4 at row 2 column 7, unmute ch #12');
  assert.deepEqual(result.location, { page: 4, row: 2, column: 7 });
  assert.deepEqual(result.action, { family: 'channel-mute', operation: 'unmute', channel: 12 });
});

test('accepts PAGE/ROW/COLUMN shorthand without treating coordinates as targets', () => {
  const channel = parseCommand('Create a mute button for channel 36 at 1/4/2');
  assert.deepEqual(channel.location, { page: 1, row: 4, column: 2 });
  assert.deepEqual(channel.action, { family: 'channel-mute', operation: 'mute', channel: 36 });
  assert.deepEqual(parseCommand('2/1/4 toggle mute channels 20 through 28').location, { page: 2, row: 1, column: 4 });
  assert.deepEqual(parseCommand('Mute auxes 1, 2 and 3 — 3/2/1').action.auxes, [1, 2, 3]);
  assert.equal(parseCommand('Set channel 12 to -6 dB at 4/3/2').action.levelDb, -6);
});

test('accepts Companion-native zero row and column IDs', () => {
  assert.deepEqual(parseCommand('Create a mute button for channel 36 at 1/0/0').location, { page: 1, row: 0, column: 0 });
});

test('distinguishes toggle from explicit mute', () => {
  const result = parseCommand('column 3 row 2: toggle mute input channel 9');
  assert.equal(result.action.operation, 'toggle-mute');
  assert.equal(parseCommand('1/4/2 flip the mute state of inputs 1 through 8').action.operation, 'toggle-mute');
  assert.equal(parseCommand('1/2/3 put inputs 51 to 54 on a flip-flop mute').action.operation, 'toggle-mute');
});

test('accepts common button-oriented mute phrasing', () => {
  assert.equal(parseCommand('Create a button at page 1 row 1 column 1 that mutes channel 36').action.operation, 'mute');
  assert.equal(parseCommand('Create an unmute button for channels 1, 3 at page 1 row 1 column 1').action.operation, 'unmute');
  assert.equal(parseCommand('page 1 row 1 column 1 button that toggles mute for channels 1 and 3').action.operation, 'toggle-mute');
});

test('accepts monitor-engineer input ranges and label phrasing', () => {
  const inputs = parseCommand('Create a mute button for inputs 51-54 on page 1 row 2 column 3 and label it "Drum Mics".');
  assert.deepEqual(inputs.action.channels, [51, 52, 53, 54]);
  assert.equal(inputs.appearance.label, 'Drum Mics');
  assert.equal(parseCommand('page 1 row 1 column 1 unmute channel 2 and label the button "RF Ready"').appearance.label, 'RF Ready');
  assert.equal(parseCommand('page 1 row 1 column 1 mute channel 2 and call it "Spare RF"').appearance.label, 'Spare RF');
});

test('parses multi-channel toggle, styling, placement, and custom text', () => {
  const result = parseCommand('Create a mute that will toggle for channels 1,3,7 and 11 on page 1, row 2 column 3 with red font, black background and "TB Mute" for text');
  assert.deepEqual(result.location, { page: 1, row: 2, column: 3 });
  assert.deepEqual(result.action, { family: 'channel-mute', operation: 'toggle-mute', channels: [1, 3, 7, 11] });
  assert.deepEqual(result.appearance, { label: 'TB Mute', textColor: '#ff0000', backgroundColor: '#000000' });
});

test('parses separate muted and unmuted toggle colors', () => {
  const result = parseCommand('Create a toggle mute button labeled "Band TB" for channels 2 through 4 on 1/2/4 with a blue font and black background when unmuted and white font with red background when muted');
  assert.equal(result.appearance.label, 'Band TB');
  assert.deepEqual(result.action.channels, [2, 3, 4]);
  assert.deepEqual(result.appearance.states, {
    unmuted: { textColor: '#0000ff', backgroundColor: '#000000' },
    muted: { textColor: '#ffffff', backgroundColor: '#ff0000' },
  });
});

test('expands channel ranges written with through, to, and hyphens', () => {
  const through = parseCommand('Create a toggle-mute button for channels 20 through 28 on page 2 row 1 column 4.');
  assert.deepEqual(through.action, { family: 'channel-mute', operation: 'toggle-mute', channels: [20, 21, 22, 23, 24, 25, 26, 27, 28] });
  assert.deepEqual(parseCommand('page 1 row 1 column 1 mute channels 3 to 5').action.channels, [3, 4, 5]);
  assert.deepEqual(parseCommand('page 1 row 1 column 1 mute channels 7-9').action.channels, [7, 8, 9]);
});

test('rejects descending channel ranges', () => {
  assert.throws(() => parseCommand('page 1 row 1 column 1 mute channels 9 through 7'), /ascending order/);
});

test('rejects commands without a location', () => {
  assert.throws(() => parseCommand('mute channel 36'), CommandParseError);
});

test('rejects unsupported and ordered actions instead of silently building a partial plan', () => {
  assert.throws(() => parseCommand('page 1 row 1 column 1 mute channel 1, wait one second, and fire snapshot 2'), /Ordered actions/);
  assert.throws(() => parseCommand('page 1 row 1 column 1 mute group output 2'), /Group-output mute/);
  assert.throws(() => parseCommand('1/2/2 turn on phantom power for channels 1 through 8'), (error) => error.details.aiEligible === false);
});

test('parses direct DiGiCo Pad Insert A/B commands', () => {
  assert.deepEqual(parseCommand('Enable insert A for channel 17 at 1/1/1').action, {
    family: 'channel-insert', operation: 'enable-insert', slots: ['A'], channels: [17], transport: 'digico-pad',
  });
  assert.deepEqual(parseCommand('Bypass insert B for channels 22 through 24 at 1/1/2').action.channels, [22, 23, 24]);
  assert.equal(parseCommand('Toggle insert A for channel 3 at 1/1/3').action.operation, 'toggle-insert');
});

test('parses aux mute, unmute, toggle, lists, and ranges', () => {
  assert.deepEqual(parseCommand('Create a button at page 3 row 1 column 1 that mutes aux 4.').action,
    { family: 'aux-mute', operation: 'mute', auxes: [4] });
  assert.deepEqual(parseCommand('Put an unmute button for aux 8 on page 3 row 1 column 2.').action,
    { family: 'aux-mute', operation: 'unmute', auxes: [8] });
  const toggle = parseCommand('Create a toggle-mute button for auxes 1, 2 and 3 at page 3 row 1 column 3 labeled "IEM Masters".');
  assert.deepEqual(toggle.action, { family: 'aux-mute', operation: 'toggle-mute', auxes: [1, 2, 3] });
  assert.equal(toggle.appearance.label, 'IEM Masters');
  assert.deepEqual(parseCommand('On page 3 row 1 column 4 create a red button called "Guest Mix Mute" that mutes auxes 9 through 12.').action.auxes, [9, 10, 11, 12]);
  assert.equal(parseCommand('At column 1 row 2 on page 3 switch mute for aux 6.').action.operation, 'toggle-mute');
});

test('parses control-group mute, unmute, toggle, lists, and ranges', () => {
  assert.deepEqual(parseCommand('Create a button at page 3 row 2 column 1 that mutes control group 6.').action,
    { family: 'control-group-mute', operation: 'mute', controlGroups: [6] });
  assert.deepEqual(parseCommand('Create an unmute button for CG 12 at page 3 row 2 column 2.').action,
    { family: 'control-group-mute', operation: 'unmute', controlGroups: [12] });
  assert.deepEqual(parseCommand('Toggle mute on control groups 2, 3 and 4 using page 3 row 2 column 3.').action.controlGroups, [2, 3, 4]);
  const range = parseCommand('Put a button labeled "All Vocals" at page 3 row 2 column 4 that mutes CGs 1 through 4.');
  assert.deepEqual(range.action.controlGroups, [1, 2, 3, 4]);
  assert.equal(range.appearance.label, 'All Vocals');
  assert.equal(parseCommand('Create a green button on page 3 row 3 column 1 that unmutes control group 24 and call it "Band On".').appearance.label, 'Band On');
});

test('parses channel fader levels, ranges, positive gain, and off', () => {
  assert.deepEqual(parseCommand('page 1 row 1 column 1 set channel 36 to 0 dB').action, { family: 'channel-fader', operation: 'set-fader', channels: [36], levelDb: 0 });
  assert.deepEqual(parseCommand('page 1 row 1 column 1 set inputs 1 through 3 to -6 dB').action.channels, [1, 2, 3]);
  assert.equal(parseCommand('page 1 row 1 column 1 set ch 30 to +3 dB').action.levelDb, 3);
  assert.equal(parseCommand("page 1 row 1 column 1 turn channel 48's fader off").action.levelDb, 'OFF');
  assert.equal(parseCommand('page 1 row 1 column 1 turn the fader for channel 48 off').action.levelDb, 'OFF');
  assert.equal(parseCommand('page 1 row 1 column 1 green button that mutes channel 2').appearance.backgroundColor, '#008000');
  assert.throws(() => parseCommand('page 1 row 1 column 1 set channel 2 to -11 dB'), /not offered/);
});

test('parses numbered, next, and previous snapshot buttons', () => {
  const numbered = parseCommand('Create button labled D to Band on 1/1/3 to fire snapshot 1');
  assert.deepEqual(numbered.action, { family: 'snapshot', operation: 'fire-snapshot', snapshot: 1 });
  assert.equal(numbered.appearance.label, 'D to Band');
  assert.deepEqual(parseCommand('2/1/4 fire next snapshot').action, { family: 'snapshot', operation: 'next-snapshot' });
  assert.deepEqual(parseCommand('2/1/5 fire previous snapshot').action, { family: 'snapshot', operation: 'previous-snapshot' });
});

test('parses numbered DiGiCo macro buttons', () => {
  const result = parseCommand('Create button labeled "Talkback" on 2/2/1 to fire macro 25');
  assert.deepEqual(result.action, { family: 'macro', operation: 'fire-macro', macro: 25 });
  assert.equal(result.appearance.label, 'Talkback');
  assert.throws(() => parseCommand('2/2/1 fire macro 257'), /Macro number must be from 1 through 256/);
});

test('treats two-color toggle shorthand as text then background and inverts it', () => {
  const result = parseCommand('create a blue and green toggle button that fires digico macro 1 and inverts colors when pressed in 1.2.3');
  assert.deepEqual(result.location, { page: 1, row: 2, column: 3 });
  assert.deepEqual(result.action, { family: 'macro', operation: 'fire-macro', macro: 1 });
  assert.equal(result.appearance.textColor, '#0000ff');
  assert.equal(result.appearance.backgroundColor, '#008000');
  assert.deepEqual(result.appearance.states.muted, { textColor: '#008000', backgroundColor: '#0000ff' });
});

test('accepts dotted and speech-recognized PAGE/ROW/COLUMN locations', () => {
  for (const command of [
    'Create a button at 1.1.1 with a blue background and yellow text that will fire macro three',
    'Create a button at one dot one dot one with a blue background and yellow text that will fire macro three',
    'Create a button at one/1/one with a blue background and yellow tech that will fire macro three',
  ]) {
    const result = parseCommand(command);
    assert.deepEqual(result.location, { page: 1, row: 1, column: 1 });
    assert.deepEqual(result.action, { family: 'macro', operation: 'fire-macro', macro: 3 });
    assert.equal(result.appearance.backgroundColor, '#0000ff');
    assert.equal(result.appearance.textColor, '#ffff00');
  }
});

test('never routes explicitly named new modules into the DiGiCo adapter', () => {
  for (const [moduleId, command] of [
    ['obs-studio', 'Toggle OBS recording at 1/1/1.'],
    ['bmd-atem', 'Put ATEM input 1 on program at 1/1/1.'],
    ['generic-osc', 'Send Generic OSC /go at 1/1/1.'],
    ['waves-lv1', 'Toggle LV1 input 1 mute at 1/1/1.'],
    ['figure53-qlab-advance', 'Create QLab GO at 1/1/1.'],
  ]) assert.throws(() => parseCommand(command), (error) => error.details?.moduleId === moduleId);
});

test('parses real-world Generic MIDI action phrasing and defaults', () => {
  assert.deepEqual(parseCommand('Fire MIDI note 36 on ch 10 at 1/1/1.').action, { family: 'midi', operation: 'noteon', channel: 10, note: 36, velocity: 127 });
  assert.deepEqual(parseCommand('Send note off 64 velocity 20 at one dot one dot two.', { targetModuleId: 'generic-midi' }).action, { family: 'midi', operation: 'noteoff', channel: 1, note: 64, velocity: 20 });
  assert.deepEqual(parseCommand('MIDI CC #7 to 100 on channel 2 at 1/1/3.').action, { family: 'midi', operation: 'cc', channel: 2, controller: 7, value: 100 });
  assert.deepEqual(parseCommand('Recall patch 128 on MIDI ch 16 at 1/1/4.').action, { family: 'midi', operation: 'program', channel: 16, program: 128 });
  assert.equal(parseCommand('Send MIDI pitch bend center on channel 3 at 1/2/1.').action.value, 8192);
  assert.equal(parseCommand('Send MIDI pitch wheel maximum on channel 3 at 1/2/2.').action.value, 16383);
  assert.equal(parseCommand('Send MIDI SysEx 240 126 127 9 1 247 at 1/2/3.').action.bytes, '0xf0 0x7e 0x7f 0x09 0x01 0xf7');
  assert.deepEqual(parseCommand('make a momentary on/off button with Ch1 midi CC 12, and Ch1 Midi CC 14 on release at 1.2.3').action, {
    family: 'midi', operation: 'momentary-cc', channel: 1,
    press: { controller: 12, value: 127 }, release: { controller: 14, value: 0 },
  });
});

test('validates Generic MIDI ranges and unsupported installed-module features', () => {
  for (const command of [
    'Send MIDI note 128 on channel 1 at 1/1/1.',
    'Send MIDI note 60 velocity 128 on channel 1 at 1/1/1.',
    'Send MIDI CC 1 value 10 on channel 17 at 1/1/1.',
    'Send MIDI program change 129 at 1/1/1.',
    'Send MIDI SysEx F0 01 02 at 1/1/1.',
  ]) assert.throws(() => parseCommand(command), CommandParseError);
  assert.throws(() => parseCommand('Put MIDI machine-control play at 1/1/1.'), /does not expose MIDI Machine Control/);
  assert.throws(() => parseCommand('Display MIDI Time Code at 1/1/1.'), /receive-only/);
});

test('explicit module selection locks routing and permits the DiGiCo baseline', () => {
  const parsed = parseCommand('Mute channel 36 at 1/1/1.', { targetModuleId: 'digico-osc' });
  assert.equal(parsed.action.channel, 36);
  assert.throws(
    () => parseCommand('Toggle OBS recording at 1/1/1.', { targetModuleId: 'digico-osc' }),
    (error) => error.details?.code === 'MODULE_TARGET_MISMATCH' && error.details.aiEligible === false,
  );
  assert.throws(
    () => parseCommand('Create a button at 1/1/1.', { targetModuleId: 'obs-studio' }),
    (error) => error.details?.code === 'MODULE_ADAPTER_PENDING' && error.details.moduleId === 'obs-studio',
  );
});
