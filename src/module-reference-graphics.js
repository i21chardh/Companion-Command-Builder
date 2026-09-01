const MODULE_MARKS = Object.freeze({
  'waves-lv1': { symbol: 'LV1', label: 'Waves LV1' },
  'digico-osc': { symbol: 'DGO', label: 'DiGiCo' },
  'digico_osc': { symbol: 'DGO', label: 'DiGiCo' },
  'spotify-remote': { symbol: 'SPOT', label: 'Spotify' },
  'cockos-reaper': { symbol: 'RPR', label: 'REAPER' },
  'obs-studio': { symbol: 'OBS', label: 'OBS Studio' },
  'figure53-qlab-advance': { symbol: 'QLAB', label: 'QLab' },
  'bmd-atem': { symbol: 'ATEM', label: 'Blackmagic ATEM' },
  'shure-wireless': { symbol: 'SHR', label: 'Shure Wireless' },
  'generic-midi': { symbol: 'MIDI', label: 'Generic MIDI' },
  'generic-osc': { symbol: 'OSC', label: 'Generic OSC' },
});

export function moduleReferenceGraphic(moduleId) {
  const id = String(moduleId || '').toLowerCase();
  const mark = MODULE_MARKS[id];
  return mark ? { id: `module:${id}`, ...mark, kind: 'module-reference', placement: 'upper-right' } : null;
}

export function applyDefaultModuleGraphic(plan) {
  if (plan?.kind !== 'create-button' || !plan.button || plan.button.graphic) return plan;
  const graphic = moduleReferenceGraphic(plan.module?.id);
  if (!graphic) return plan;
  plan.button.graphic = graphic;
  return plan;
}
