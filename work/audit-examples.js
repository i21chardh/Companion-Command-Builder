import { parseCommand } from '../src/parser.js';
import { buildDeploymentPlan } from '../src/plan.js';
import { defaultConfig } from '../src/config.js';

const examples = {
  'Channel mute': [
    'Create a button at page 1 row 1 column 1 that mutes channel 36.',
    'Create an unmute button for channels 1, 3, 7, and 11 at page 1 row 2 column 3.',
    'Create a toggle-mute button for channels 20 through 28 on page 2 row 1 column 4.',
    'Put a button labeled "All Vocals" at page 1 row 3 column 2 that toggles mute for channels 30, 31, 32, and 33, with white text and red background.',
  ],
  'Channel faders': [
    'Create a button on page 2 row 1 column 1 that sets channel 36 to 0 dB.',
    'Set the fader for channel 12 to -10 dB from a button at page 2 row 1 column 2.',
    'Create a button labeled "Music Down" at page 2 row 2 column 1 that sets channels 41 and 42 to -20 dB.',
    "Create a button at page 2 row 2 column 2 that turns channel 48's fader off.",
  ],
  'Aux mute': [
    'Create a button at page 3 row 1 column 1 that mutes aux 4.',
    'Create an unmute button for aux 8 at page 3 row 1 column 2.',
    'Create a toggle-mute button for auxes 1, 2, and 3 at page 3 row 1 column 3 with text "IEM Mutes".',
  ],
  'Control groups': [
    'Create a button at page 3 row 2 column 1 that mutes control group 6.',
    'Create a button labeled "Band Mute" at page 3 row 2 column 2 that toggles mute on control groups 2, 3, and 4.',
    'Create an unmute button for CG 12 at page 3 row 2 column 3 with black text and green background.',
  ],
  'Group outputs': [
    'Create a button at page 3 row 3 column 1 that mutes group output 5.',
    'Toggle mute on group outputs 1 and 2 using page 3 row 3 column 2.',
    'Create a button labeled "Broadcast Out" at page 3 row 3 column 3 that unmutes group output 8.',
  ],
  Solo: [
    'Create a button at page 4 row 1 column 1 that solos channel 36.',
    'Create a button at page 4 row 1 column 2 that turns solo off for channel 36.',
    'Create a toggle-solo button for channel 12 at page 4 row 1 column 3 with text "PFL Lead".',
  ],
  Snapshots: [
    'Create a button at page 5 row 1 column 1 that fires snapshot 12.',
    'Create a button labeled "Opening" at page 5 row 1 column 2 that recalls snapshot 100.',
    'Create a button at page 5 row 1 column 3 that fires the next snapshot.',
    'Create a button at page 5 row 1 column 4 that fires the previous snapshot.',
  ],
  'DiGiCo macros': [
    'Create a button at page 5 row 2 column 1 that fires DiGiCo macro 12.',
    'Create a button labeled "Talkback" at page 5 row 2 column 2 that runs macro 25 with red text and black background.',
    'Put macro 100 on page 5 row 2 column 3 and label the button "Record Feed".',
  ],
  'Ordered actions': [
    'Create a button at page 6 row 1 column 1 that mutes channels 1 through 8, waits one second, and fires snapshot 20.',
    'Create a button labeled "Show Start" at page 6 row 1 column 2 that fires snapshot 10, waits 500 milliseconds, unmutes control group 2, and sets channels 41 and 42 to 0 dB.',
    'Create a button at page 6 row 1 column 3 that mutes aux 4, disables solo on channel 36, and fires DiGiCo macro 8.',
  ],
};

let passed = 0;
let failed = 0;
for (const [category, commands] of Object.entries(examples)) {
  const results = commands.map((command) => {
    try {
      buildDeploymentPlan(parseCommand(command), defaultConfig);
      passed += 1;
      return { status: 'PASS', command };
    } catch (error) {
      failed += 1;
      return { status: 'FAIL', command, error: error.message };
    }
  });
  console.log(`\n${category}: ${results.filter((result) => result.status === 'PASS').length}/${commands.length}`);
  for (const result of results) console.log(`  ${result.status} ${result.status === 'FAIL' ? result.error : ''}`);
}
console.log(`\nTOTAL ${passed}/${passed + failed} passed; ${failed} need implementation`);
