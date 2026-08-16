const aliases = [
  [/(?:\bobs(?:\s+studio)?\b)/i, 'obs-studio'],
  [/(?:\bqlab\b)/i, 'figure53-qlab-advance'],
  [/(?:\batem\b|blackmagic\s+(?:design\s+)?atem)/i, 'bmd-atem'],
  [/(?:\bdigico\b|digico[_ -]?osc)/i, 'digico-osc'],
  [/(?:\bshure(?:\s+wireless)?\b|\baxient(?:\s+digital)?\b|\bAD4[DQ]\b)/i, 'shure-wireless'],
  [/(?:\b(?:waves\s+)?lv1\b)/i, 'waves-lv1'],
  [/(?:\bgeneric\s+midi\b)/i, 'generic-midi'],
  [/(?:\bgeneric\s+osc\b)/i, 'generic-osc'],
  [/(?:\breaper\b)/i, 'cockos-reaper'],
];

export function explicitlyNamedModule(command) {
  return aliases.find(([pattern]) => pattern.test(String(command || '')))?.[1] || '';
}

export function resolveBatchModule(command, selectedModuleId = '') {
  return explicitlyNamedModule(command) || selectedModuleId || '';
}
