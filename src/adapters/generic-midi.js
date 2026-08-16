export const genericMidiAdapter = Object.freeze({
  moduleId: 'generic-midi',
  displayName: 'Generic MIDI',
  category: 'Generic protocol',
  supportedVersions: ['1.4.0'],
  verification: 'schema-tested',
  capabilities: ['Note On', 'Note Off', 'Control Change', 'Program Change', 'Pitch Wheel', 'SysEx'],
  actionIds: ['noteon', 'noteoff', 'cc', 'program', 'pitch', 'sysex'],
  graphics: [
    { id: 'note', symbol: '♪', label: 'MIDI Note' },
    { id: 'cc', symbol: 'CC', label: 'Control Change' },
    { id: 'program', symbol: 'PC', label: 'Program Change' },
    { id: 'sysex', symbol: 'SX', label: 'SysEx' },
  ],
});
