import { interpretKnownDynamicCommand } from './deterministic-dynamic.js';
import { parseCommand } from './parser.js';

const STATIC_PARSERS = new Set(['digico-osc', 'generic-midi']);

export function deterministicModuleCandidates(command, modules = []) {
  const candidates = new Set();
  for (const module of modules) {
    const moduleId = module.moduleId;
    if (!moduleId) continue;
    if (module.adapter && interpretKnownDynamicCommand(command, module.adapter)) {
      candidates.add(moduleId);
      continue;
    }
    if (!STATIC_PARSERS.has(moduleId)) continue;
    try {
      parseCommand(command, { targetModuleId: moduleId });
      candidates.add(moduleId);
    } catch { /* The request does not match this module's deterministic parser. */ }
  }
  return [...candidates];
}
