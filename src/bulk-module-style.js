import { moduleReferenceGraphic } from './module-reference-graphics.js';

const MODULE_STYLES = Object.freeze({
  'waves-lv1': { backgroundColor: '#0057b8', textColor: '#ffffff' },
  'digico-osc': { backgroundColor: '#5b2380', textColor: '#ffffff' },
  'spotify-remote': { backgroundColor: '#1db954', textColor: '#000000' },
  'cockos-reaper': { backgroundColor: '#c95f13', textColor: '#ffffff' },
  'obs-studio': { backgroundColor: '#302e31', textColor: '#ffffff' },
  'figure53-qlab-advance': { backgroundColor: '#174ea6', textColor: '#ffffff' },
  'bmd-atem': { backgroundColor: '#b00020', textColor: '#ffffff' },
  'shure-wireless': { backgroundColor: '#0072ce', textColor: '#ffffff' },
  'generic-midi': { backgroundColor: '#7030a0', textColor: '#ffffff' },
  'generic-osc': { backgroundColor: '#008577', textColor: '#ffffff' },
});

export function isBulkModuleStyleCommand(command) {
  const text = String(command || '').trim();
  return /^(?:please\s+)?(?:update|style|color|colour)\s+all\s+buttons?\b/i.test(text)
    && /\b(?:surface|device|deck|layout)\b/i.test(text)
    && /\b(?:module|connection|associated|target)\b/i.test(text)
    && /\b(?:color|colour|scheme|badge|image)\b/i.test(text);
}

export function moduleStyle(moduleId) {
  return MODULE_STYLES[String(moduleId || '').toLowerCase()] || null;
}

export function buildBulkModuleStylePlans({ command, buttons, connections, surface, pageNumber }) {
  const connectionModules = new Map((connections || []).map((item) => [item.id, item.moduleId]));
  const plans = [];
  const skipped = [];
  for (const button of buttons || []) {
    const withinSurface = button.row >= surface.yOffset && button.row < surface.yOffset + surface.rows
      && button.column >= surface.xOffset && button.column < surface.xOffset + surface.columns;
    if (!withinSurface) continue;
    const moduleIds = [...new Set((button.programmedActions || []).map((action) => connectionModules.get(action.connectionId)).filter((id) => id && id !== 'internal'))];
    if (moduleIds.length !== 1) {
      skipped.push({ location: `${pageNumber}/${button.row}/${button.column}`, reason: moduleIds.length ? 'multiple target modules' : 'no readable target module' });
      continue;
    }
    const moduleId = moduleIds[0];
    const style = moduleStyle(moduleId);
    const graphic = moduleReferenceGraphic(moduleId);
    if (!style || !graphic) {
      skipped.push({ location: `${pageNumber}/${button.row}/${button.column}`, reason: `no visual scheme for ${moduleId}` });
      continue;
    }
    plans.push({
      schemaVersion: 1, kind: 'edit-button', target: { product: 'Bitfocus Companion' }, module: { id: moduleId },
      button: {
        location: { page: pageNumber, row: button.row, column: button.column }, text: button.text,
        appearance: { ...style, textSize: button.textSize ?? 'auto' }, graphic,
        action: { family: 'existing', operation: 'preserve' },
      },
      actions: [{ step: '—', actionId: 'preserved', summary: `Preserve actions and apply ${graphic.label} identity` }],
      edit: {
        changes: { ...style, graphic },
        original: { textColor: button.textColor, backgroundColor: button.backgroundColor },
        descriptions: [`Apply ${graphic.label} color scheme and app badge`],
      },
      sourceText: command,
    });
  }
  return { plans, skipped };
}
