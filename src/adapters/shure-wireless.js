export const shureWirelessAdapter = Object.freeze({
  moduleId: 'shure-wireless',
  displayName: 'Shure Wireless',
  category: 'Wireless audio',
  supportedVersions: ['2.3.1'],
  verification: 'documented',
  capabilities: [
    'Channel naming', 'Channel mute', 'Channel gain', 'Channel frequency',
    'Receiver flash', 'Receiver-channel flash', 'Axient slot RF output', 'Axient slot RF power',
  ],
  graphics: [
    { id: 'mic', symbol: '◉', label: 'Wireless Mic' },
    { id: 'mute', symbol: '⊘', label: 'Mic Mute' },
    { id: 'gain', symbol: '↕', label: 'Mic Gain' },
    { id: 'frequency', symbol: 'RF', label: 'Frequency / RF' },
    { id: 'battery', symbol: '▣', label: 'Battery' },
    { id: 'flash', symbol: '✹', label: 'Identify / Flash' },
  ],
  promptExamples: [
    'Toggle mute on Shure channel 1 at 1/1/1 labeled Vocal 1.',
    'Increase the gain of Shure channel 2 by 2 dB at 1/1/2.',
    'Set Shure channel 3 frequency to 550.250 MHz at 1/1/3.',
    'Flash the Shure receiver at 1/1/4 labeled Identify Rack.',
  ],
});
