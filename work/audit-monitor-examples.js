import assert from 'node:assert/strict';
import { parseCommand } from '../src/parser.js';
import { buildDeploymentPlan } from '../src/plan.js';
import { defaultConfig } from '../src/config.js';

const cases = [
  {
    command: 'On page 1 row 1 column 1, create a button labeled "Band Mute" that toggles mute on channels 1 through 12 with white text and red background.',
    expected: { operation: 'toggle-mute', channels: [1,2,3,4,5,6,7,8,9,10,11,12], text: 'Band Mute', page: 1, row: 1, column: 1 },
  },
  {
    command: 'Put an unmute button for input channels 25, 26, 27 and 28 on page 1 row 1 column 2 with black text and green background, labeled "Vocals On".',
    expected: { operation: 'unmute', channels: [25,26,27,28], text: 'Vocals On', page: 1, row: 1, column: 2 },
  },
  {
    command: 'Page 1 row 2 column 1: mute ch 48 with "Tech Mic Safe" for text, white font and red background.',
    expected: { operation: 'mute', channels: [48], text: 'Tech Mic Safe', page: 1, row: 2, column: 1 },
  },
  {
    command: 'At row 2 column 2 on page 1 create a toggle mute button for channels 41 and 42 labeled "Playback".',
    expected: { operation: 'toggle-mute', channels: [41,42], text: 'Playback', page: 1, row: 2, column: 2 },
  },
  {
    command: 'Create a mute button for inputs 51-54 on page 1 row 2 column 3 and label it "Drum Mics".',
    expected: { operation: 'mute', channels: [51,52,53,54], text: 'Drum Mics', page: 1, row: 2, column: 3 },
  },
  {
    command: 'Create a toggle-mute button for channels 60 to 63 on page 1 row 3 column 1 with text "Guest IEM".',
    expected: { operation: 'toggle-mute', channels: [60,61,62,63], text: 'Guest IEM', page: 1, row: 3, column: 1 },
  },
  {
    command: 'Create a button on page 1 row 3 column 2 that unmutes channels 70 through 75 and label the button "RF Ready".',
    expected: { operation: 'unmute', channels: [70,71,72,73,74,75], text: 'RF Ready', page: 1, row: 3, column: 2 },
  },
  {
    command: 'Put a mute button for channel number 96 at page 2 column 1 row 1 labeled "Spare RF".',
    expected: { operation: 'mute', channels: [96], text: 'Spare RF', page: 2, row: 1, column: 1 },
  },
  {
    command: 'Create a button at page 2 row 1 column 2 that mutes channels 101, 103 and 105 with text "Utility Mute".',
    expected: { operation: 'mute', channels: [101,103,105], text: 'Utility Mute', page: 2, row: 1, column: 2 },
  },
  {
    command: 'At page 2 column 4 row 3 create a button that toggles the mute state of channels 7 and 8 with "Talkback" for text.',
    expected: { operation: 'toggle-mute', channels: [7,8], text: 'Talkback', page: 2, row: 3, column: 4 },
  },
  {
    command: 'Create a button on page 2 row 2 column 3 that will switch mute for channels 13-20 and call it "All Wedges".',
    expected: { operation: 'toggle-mute', channels: [13,14,15,16,17,18,19,20], text: 'All Wedges', page: 2, row: 2, column: 3 },
  },
  {
    command: 'Create an unmute button at column 5 row 3 on page 2 for channels 121, 122 and 123 with green background and text "Comms On".',
    expected: { operation: 'unmute', channels: [121,122,123], text: 'Comms On', page: 2, row: 3, column: 5 },
  },
];

let passed = 0;
for (const { command, expected } of cases) {
  try {
    const plan = buildDeploymentPlan(parseCommand(command), defaultConfig);
    assert.equal(plan.button.action.operation, expected.operation);
    assert.deepEqual(plan.button.action.channels, expected.channels);
    assert.equal(plan.button.text, expected.text);
    assert.deepEqual(plan.button.location, { page: expected.page, row: expected.row, column: expected.column });
    passed += 1;
    console.log(`PASS ${command}`);
  } catch (error) {
    console.log(`FAIL ${error.message}\n     ${command}`);
  }
}
console.log(`\nMONITOR BASELINE ${passed}/${cases.length} passed`);
