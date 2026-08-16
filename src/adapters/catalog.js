// Ordered onboarding queue. Runtime definitions from the connected Companion
// instance remain authoritative; versions here describe the audited baseline.
export const ADAPTER_DEVELOPMENT_QUEUE = Object.freeze([
  { priority: 1, moduleId: 'shure-wireless', name: 'Shure Wireless', category: 'Wireless audio', baselineVersion: '2.3.1', status: 'documented' },
  { priority: 2, moduleId: 'figure53-qlab-advance', name: 'Figure 53 QLab', category: 'Show control', baselineVersion: '2.14.1', status: 'installed' },
  { priority: 3, moduleId: 'bmd-atem', name: 'Blackmagic Design ATEM', category: 'Video switcher', baselineVersion: '4.1.2', status: 'queued' },
  { priority: 4, moduleId: 'obs-studio', name: 'OBS Studio', category: 'Video production', baselineVersion: '3.15.3', status: 'queued' },
  { priority: 5, moduleId: 'generic-midi', name: 'Generic MIDI', category: 'Generic protocol', baselineVersion: '1.4.0', status: 'schema-tested' },
  { priority: 6, moduleId: 'generic-osc', name: 'Generic OSC', category: 'Generic protocol', baselineVersion: '2.7.0', status: 'installed' },
  { priority: 7, moduleId: 'waves-lv1', name: 'Waves LV1', category: 'Audio console', baselineVersion: '1.0.4', status: 'schema-tested' },
]);

const AUDIO_CONSOLE_TERMS = /(?:console|mixer|mixing|audio desk|digital mixer|foh)/i;

export function isAudioConsoleModule(manifest = {}) {
  const searchable = [
    manifest.id, manifest.name, manifest.description, manifest.manufacturer,
    ...(manifest.products || []), ...(manifest.keywords || []),
  ].filter(Boolean).join(' ');
  return AUDIO_CONSOLE_TERMS.test(searchable);
}

export function adapterDevelopmentQueue() {
  return ADAPTER_DEVELOPMENT_QUEUE.map((entry) => ({ ...entry }));
}
