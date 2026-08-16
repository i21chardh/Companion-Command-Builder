import { parseCommand } from '../src/parser.js';
import { buildDeploymentPlan } from '../src/plan.js';
import { defaultConfig } from '../src/config.js';

const suites = {
  Faders: [
    'Create a button on page 2 row 1 column 1 that sets channel 36 to 0 dB.',
    'At page 2 column 2 row 1 put channel 12 at -10 dB and label it "Lead Vocal Nominal".',
    'Create a button labeled "Tracks Down" at page 2 row 1 column 3 that sets inputs 41 and 42 to -20 dB.',
    'Put a button at page 2 row 1 column 4 that turns the fader for channel 48 off.',
    'Set channels 1 through 8 to -6 dB from a button on page 2 row 2 column 1.',
    'Create a green button at page 2 row 2 column 2 that sets ch 30 to +3 dB with text "Vocal Up".',
  ],
  Auxes: [
    'Create a button at page 3 row 1 column 1 that mutes aux 4.',
    'Put an unmute button for aux 8 on page 3 row 1 column 2.',
    'Create a toggle-mute button for auxes 1, 2 and 3 at page 3 row 1 column 3 labeled "IEM Masters".',
    'On page 3 row 1 column 4 create a red button called "Guest Mix Mute" that mutes auxes 9 through 12.',
    'At column 1 row 2 on page 3 switch mute for aux 6.',
  ],
  'Control groups': [
    'Create a button at page 3 row 2 column 1 that mutes control group 6.',
    'Create an unmute button for CG 12 at page 3 row 2 column 2.',
    'Toggle mute on control groups 2, 3 and 4 using page 3 row 2 column 3.',
    'Put a button labeled "All Vocals" at page 3 row 2 column 4 that mutes CGs 1 through 4.',
    'Create a green button on page 3 row 3 column 1 that unmutes control group 24 and call it "Band On".',
  ],
  'Group outputs': [
    'Create a button at page 4 row 1 column 1 that mutes group output 5.',
    'Put an unmute button for group output 8 on page 4 row 1 column 2.',
    'Toggle mute on group outputs 1 and 2 using page 4 row 1 column 3.',
    'Create a button called "Broadcast Sends" at page 4 row 1 column 4 that mutes group outputs 9 through 12.',
    'At page 4 row 2 column 1 switch mute for group output 6 with white text and red background.',
  ],
  Solo: [
    'Create a button at page 4 row 2 column 2 that solos channel 36.',
    'Create a button on page 4 row 2 column 3 that turns solo off for channel 36.',
    'Create a toggle-solo button for ch 12 at page 4 row 2 column 4 labeled "PFL Lead".',
    'Put a button at page 4 row 3 column 1 that solos channels 41 and 42 with text "PFL Tracks".',
    'At column 2 row 3 on page 4 disable solo for inputs 1 through 8.',
  ],
  Snapshots: [
    'Create a button at page 5 row 1 column 1 that fires snapshot 12.',
    'Put snapshot 100 on page 5 row 1 column 2 and label it "Opening".',
    'Create a button at page 5 row 1 column 3 that recalls snapshot 250.',
    'Create a next-snapshot button at page 5 row 1 column 4.',
    'Create a previous snapshot button at page 5 row 1 column 5.',
    'At page 5 row 2 column 1 fire snapshot 9999 with white text and blue background and call it "Reset".',
  ],
  Macros: [
    'Create a button at page 5 row 2 column 2 that fires DiGiCo macro 12.',
    'Put macro 25 on page 5 row 2 column 3 and label it "Talkback".',
    'Create a button called "Record Feed" at page 5 row 2 column 4 that runs macro 100.',
    'At page 5 row 2 column 5 execute DiGiCo macro 1.',
    'Create a red button at page 5 row 3 column 1 that triggers macro 256 with text "Emergency".',
  ],
};

const expectedImplemented = new Set(['Faders', 'Auxes', 'Control groups']);

let passed = 0;
let rejected = 0;
const reasons = new Map();
for (const [family, commands] of Object.entries(suites)) {
  let familyPassed = 0;
  for (const command of commands) {
    try {
      buildDeploymentPlan(parseCommand(command), defaultConfig);
      passed += 1;
      familyPassed += 1;
      console.log(`${expectedImplemented.has(family) ? 'PASS' : 'UNEXPECTED PASS'} [${family}] ${command}`);
    } catch (error) {
      rejected += 1;
      reasons.set(error.message, (reasons.get(error.message) || 0) + 1);
    }
  }
  console.log(`${family}: ${familyPassed}/${commands.length} implemented`);
}

console.log(`\nREMAINING-ACTIONS BASELINE: ${passed}/${passed + rejected} implemented; ${rejected} safely rejected`);
console.log('\nRejection groups:');
for (const [reason, count] of reasons) console.log(`  ${count} × ${reason}`);
