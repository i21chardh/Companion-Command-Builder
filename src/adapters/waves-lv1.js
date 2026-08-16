// Audited against the locally installed Waves LV1 1.0.4 manifest, HELP.md,
// and bundled setActionDefinitions. +48 V is intentionally excluded.
export const wavesLv1Adapter = Object.freeze({
  moduleId: 'waves-lv1',
  displayName: 'Waves LV1',
  category: 'Audio console',
  supportedVersions: ['1.0.4'],
  verification: 'schema-tested',
  capabilities: [
    'Channel mute', 'Channel solo', 'Channel output fader', 'Send on/off', 'Send fader',
    'Fader fade', 'Channel pan and width', 'Send pan', 'Mute groups', 'Talkback',
    'Spill', 'Clear solo', 'Aux focus', 'Scenes', 'User keys', 'Tap tempo',
    'Input gain', 'Digital trim', 'Polarity', 'Plugin enable', 'EQ bands', 'Channel rename', 'Raw OSC',
  ],
  actionIds: [
    'mute', 'solo', 'outGain', 'pan', 'width', 'sendOn', 'sendGain', 'fadeFader', 'sendPan',
    'flipSendsViaUserKey', 'spillButton', 'talkBackToOutput', 'clearAllSolo', 'auxSelect',
    'muteGroup', 'userKey', 'sceneRecall', 'sceneRecallByName', 'sceneNext', 'scenePrev',
    'tapTempo', 'inGain', 'trim', 'polarity', 'pluginEnable', 'eqBand', 'rename',
    'refreshState', 'scanForLv1', 'rawOsc',
  ],
  excludedActionIds: ['phantom'],
  graphics: [
    { id: 'mute', symbol: '⊘', label: 'Mute' },
    { id: 'solo', symbol: 'S', label: 'Solo' },
    { id: 'fader', symbol: '↕', label: 'Fader' },
    { id: 'send', symbol: 'AUX', label: 'Aux Send' },
    { id: 'talkback', symbol: '◉', label: 'Talkback' },
    { id: 'scene', symbol: '▶', label: 'Scene' },
    { id: 'user-key', symbol: 'UK', label: 'User Key' },
  ],
  promptExamples: [
    'Toggle mute on LV1 input 1 at 1/1/1 labeled Lead Vocal.',
    'Set LV1 input 2 output fader to -6 dB at 1/1/2.',
    'Toggle the LV1 send from input 3 to aux 2 at 1/1/3.',
    'Recall LV1 scene 5 at 1/1/4 labeled Changeover.',
    'Engage LV1 talkback to aux 4 at 1/2/1 labeled Mix 4 TB.',
  ],
});
