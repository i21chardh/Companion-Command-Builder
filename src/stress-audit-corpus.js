export const STRESS_PROMPTS = [
  { id: 'position-native-zero', category: 'coordinates', severity: 'critical', moduleId: 'digico-osc', prompt: 'Create a button at 1/0/0 that fires macro 3', expect: { location: [1, 0, 0], operation: 'fire-macro' } },
  { id: 'position-slash', category: 'coordinates', severity: 'critical', moduleId: 'digico-osc', prompt: 'Create a mute button for channel 36 at 1/3/1', expect: { location: [1, 3, 1], operation: 'mute', channels: [36] } },
  { id: 'position-dot', category: 'coordinates', severity: 'critical', moduleId: 'digico-osc', prompt: 'Create a mute button for channel 2 at 2.1.4', expect: { location: [2, 1, 4], operation: 'mute', channels: [2] } },
  { id: 'position-speech', category: 'coordinates', severity: 'high', moduleId: 'digico-osc', prompt: 'Create a button at one dot two dot three that fires macro three', expect: { location: [1, 2, 3], operation: 'fire-macro' } },
  { id: 'range-through', category: 'parser', severity: 'critical', moduleId: 'digico-osc', prompt: 'Create a toggle mute for channels 20 through 28 at 2/1/4', expect: { location: [2, 1, 4], operation: 'toggle-mute', channels: [20,21,22,23,24,25,26,27,28] } },
  { id: 'sparse-list-style', category: 'appearance', severity: 'critical', moduleId: 'digico-osc', prompt: 'Create a mute that will toggle for channels 1,3,7 and 11 on 1/2/3 with red font, black background and "TB Mute" for text', expect: { location: [1, 2, 3], operation: 'toggle-mute', channels: [1,3,7,11], textColor: '#ff0000', backgroundColor: '#000000' } },
  { id: 'toggle-invert', category: 'appearance', severity: 'critical', moduleId: 'digico-osc', prompt: 'Create a blue and green toggle button that fires digico macro 1 and inverts colors when pressed at 1/2/3', expect: { location: [1, 2, 3], operation: 'fire-macro', states: true } },
  { id: 'snapshot-natural', category: 'parser', severity: 'high', moduleId: 'digico-osc', prompt: 'Create button labeled D to Band at 1/1/3 to fire snapshot 1', expect: { location: [1, 1, 3], operation: 'fire-snapshot' } },
  { id: 'macro-natural', category: 'parser', severity: 'high', moduleId: 'digico-osc', prompt: 'Create a button labeled Waves at 1/1/4 to fire macro 12', expect: { location: [1, 1, 4], operation: 'fire-macro' } },
  { id: 'fader-off', category: 'parser', severity: 'high', moduleId: 'digico-osc', prompt: 'Create a button at 1/2/1 to set channel 12 fader off', expect: { location: [1, 2, 1], operation: 'set-fader' } },
  { id: 'aux-toggle', category: 'parser', severity: 'high', moduleId: 'digico-osc', prompt: 'Create an aux 5 toggle mute at 1/2/2', expect: { location: [1, 2, 2], operation: 'toggle-mute' } },
  { id: 'cg-mute', category: 'parser', severity: 'high', moduleId: 'digico-osc', prompt: 'Mute control group 3 with a button at 1/2/3', expect: { location: [1, 2, 3], operation: 'mute' } },
  { id: 'midi-momentary-cc-press-release', category: 'parser', severity: 'critical', moduleId: 'generic-midi', prompt: 'make a momentary on/off button with Ch1 midi CC 12, and Ch1 Midi CC 14 on release at 1.2.3', expect: { location: [1, 2, 3], operation: 'momentary-cc', pressController: 12, pressValue: 127, releaseController: 14, releaseValue: 0 } },
];

export const EDIT_PROMPTS = [
  { id: 'edit-native-zero', severity: 'critical', prompt: 'change button 1.0.0 background to blue', expect: { location: [1,0,0], backgroundColor: '#0000ff' } },
  { id: 'rename-dot', severity: 'critical', prompt: 'rename 1.2.3 to "waves toggle"', expect: { location: [1,2,3], text: 'waves toggle' } },
  { id: 'color-edit', severity: 'critical', prompt: 'change the font on 1/2/3 to red', expect: { location: [1,2,3], textColor: '#ff0000' } },
  { id: 'background-edit', severity: 'critical', prompt: 'change button 1.2.1 background to blue', expect: { location: [1,2,1], backgroundColor: '#0000ff' } },
  { id: 'toggle-existing', severity: 'critical', prompt: 'change button 1.2.1 to toggle and invert colors when toggled', expect: { location: [1,2,1], visualToggle: true } },
];

export const APPEARANCE_CASES = [
  { id: 'short-stop', text: 'STOP', requested: 'auto', expectedPercent: 45 },
  { id: 'audit-five', text: 'AUDIT', requested: 'auto', expectedPercent: 36 },
  { id: 'graphic-stop', text: '▶\nSTOP', requested: 'auto', expectedPercent: 45 },
  { id: 'long-word', text: 'COMMUNICATION', requested: 'auto', expectedPercent: 13 },
  { id: 'manual-cap', text: 'AUDIT', requested: 25, expectedPercent: 25 },
];

export const LIVE_WORKFLOWS = [
  { id: 'quick-edit-color-lock', category: 'rendering', severity: 'critical', steps: 'Select an exact Companion button; change font color and then background color. The font face/glyph shapes, coordinate band, font size, line breaks, scaling, and graphic must remain unchanged in preview and on the surface.' },
  { id: 'render-color-matrix', category: 'rendering', severity: 'critical', steps: 'Temporary button: compare CCB preview and Companion render for red/yellow, blue/white, green/black, white/black, purple/white.' },
  { id: 'render-wrap-order', category: 'rendering', severity: 'critical', steps: 'Compare STOP, AUDIT, LONG WORD TEST, and graphic-prefixed labels; no word may split mid-word.' },
  { id: 'global-grid-offset', category: 'coordinates', severity: 'critical', steps: 'Verify every displayed CCB PAGE/ROW/COLUMN exactly equals Companion’s native grid ID, including row and column 0.' },
  { id: 'rightmost-physical-key', category: 'coordinates', severity: 'critical', steps: 'Move SNAP 5 to Companion/CCB 2/2/8; verify the physical rightmost key updates and the old key clears.' },
  { id: 'device-switch-first-click', category: 'devices', severity: 'high', steps: 'Switch A→B→A once each; selection and grid must change on the first interaction.' },
  { id: 'satellite-enrollment', category: 'devices', severity: 'critical', steps: 'Restart with Satellite surfaces available. Verify CCB starts in a blank offline editor, enrolls no network surface automatically, and presents a sync-direction prompt as each surface is selected individually.' },
  { id: 'satellite-offline-inventory', category: 'devices', severity: 'critical', steps: 'With a Satellite surface configured in Companion but disconnected, verify Network & Satellite reports it as configured and offline rather than connected. Open Workspace surfaces and verify the Satellite entry is visible, disabled, and says reconnect to enroll. Reconnect Satellite and verify the same entry becomes selectable and presents the sync-direction prompt.' },
  { id: 'satellite-runtime-id-reconciliation', category: 'devices', severity: 'critical', steps: 'Connect a Satellite Stream Deck whose runtime id has a -devN suffix while Companion stores the base serial id and reports connected false. Enter the Satellite address in CCB. Verify CCB confirms the Satellite status and surface APIs, shows the configured surface online under its stable Companion id, and presents the sync-direction prompt without replacing or clearing its layout.' },
  { id: 'offline-surface-deselect', category: 'devices', severity: 'critical', steps: 'In offline mode with only the 5×3 Stream Deck selected, uncheck it in Workspace surfaces. Verify the grid shows No surface selected, then choose another template and verify it becomes active on the first click without restoring 5×3.' },
  { id: 'mixed-online-offline-workspace', category: 'devices', severity: 'critical', steps: 'With a physical Stream Deck online, open Workspace surfaces and add an unconnected offline model. Verify both grids remain visible and independent. Remove and re-add the online device and verify the normal sync-direction prompt still appears.' },
  { id: 'drag-cross-layer', category: 'lifecycle', severity: 'high', steps: 'Move a temporary button layer 1→2→1; preserve actions, style, and exact render; no MOVING ghost remains.' },
  { id: 'save-load-roundtrip', category: 'persistence', severity: 'critical', steps: 'Create three styled buttons on two layers. Use Save As and verify the filename/location picker, modify and use Save to the same file, clear the editor, then Load and deep-compare every page, location, action, and style.' },
  { id: 'disconnect-reset', category: 'devices', severity: 'high', steps: 'Disconnect Companion; buttons and module state must clear and show offline without stale data.' },
  { id: 'toggle-feedback', category: 'state', severity: 'critical', steps: 'Toggle a two-state button; CCB preview, Companion render, and device colors must follow the same state.' },
];
