export const digicoOscAdapter = Object.freeze({
  moduleId: 'digico-osc',
  displayName: 'DiGiCo OSC',
  category: 'Audio console',
  supportedVersions: ['1.0.4'],
  verification: 'verified',
  capabilities: [
    'Channel mute', 'Channel fader', 'Aux mute', 'Control-group mute', 'Snapshots', 'Macros',
  ],
  graphics: [
    { id: 'mute', symbol: '⊘', label: 'Mute' },
    { id: 'tb', symbol: '◉', label: 'Talkback / TB' },
    { id: 'snapshot', symbol: '▶', label: 'Snapshot' },
    { id: 'macro', symbol: '◆', label: 'Macro' },
    { id: 'aux', symbol: 'AUX', label: 'Aux' },
    { id: 'cg', symbol: 'CG', label: 'Control Group' },
    { id: 'fader', symbol: '↕', label: 'Fader' },
  ],
});
