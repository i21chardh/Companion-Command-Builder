const MODULE_MARKS = Object.freeze({
  'waves-lv1': { symbol: 'LV1', label: 'Waves LV1' },
  'digico-osc': { symbol: 'DiGiCo', label: 'DiGiCo' },
  'digico_osc': { symbol: 'DiGiCo', label: 'DiGiCo' },
  'spotify-remote': { symbol: 'Spotify', label: 'Spotify' },
  'cockos-reaper': { symbol: 'REAPER', label: 'REAPER' },
  'obs-studio': { symbol: 'OBS', label: 'OBS Studio' },
  'figure53-qlab-advance': { symbol: 'QLAB', label: 'QLab' },
  'bmd-atem': { symbol: 'ATEM', label: 'Blackmagic ATEM' },
  'shure-wireless': { symbol: 'SHURE', label: 'Shure Wireless' },
  'generic-midi': { symbol: 'MIDI', label: 'Generic MIDI' },
  'generic-osc': { symbol: 'OSC', label: 'Generic OSC' },
});

export function moduleReferenceGraphic(moduleId) {
  const id = String(moduleId || '').toLowerCase();
  const mark = MODULE_MARKS[id];
  return mark ? { id: `module:${id}`, ...mark, kind: 'module-reference' } : null;
}

export function applyDefaultModuleGraphic(plan) {
  if (plan?.kind !== 'create-button' || !plan.button || plan.button.graphic) return plan;
  const graphic = moduleReferenceGraphic(plan.module?.id);
  if (!graphic) return plan;
  plan.button.graphic = graphic;
  const text = String(plan.button.text || '').trim();
  if (text && text !== graphic.symbol && !text.startsWith(`${graphic.symbol}\n`)) plan.button.text = `${graphic.symbol}\n${text}`;
  return plan;
}
