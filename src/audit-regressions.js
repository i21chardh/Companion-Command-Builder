import { readLanguageMemory, DEFAULT_LANGUAGE_MEMORY } from './language-memory.js';
import { readModuleOnboardingDatabase, DEFAULT_ONBOARDING_DATABASE, auditOnboardingPrompts, generateOnboardingPrompts } from './adapters/onboarding.js';
import { interpretKnownDynamicCommand } from './deterministic-dynamic.js';
import { resolveBatchModule } from './module-routing.js';

function withLocation(command) {
  return /\d+\s*[/.]\s*\d+\s*[/.]\s*\d+/.test(command) ? command : `${command} at 1/1/1`;
}

export async function auditOnboardedModuleCommands({ databasePath = DEFAULT_ONBOARDING_DATABASE } = {}) {
  const database = await readModuleOnboardingDatabase(databasePath);
  const cases = [];
  for (const record of Object.values(database.modules || {})) {
    const adapter = record.compiledAdapter;
    if (!adapter) {
      const saved = record.prompts || [];
      cases.push({ id: `${record.moduleId}:onboarding`, moduleId: record.moduleId, status: 'pending', generated: saved.length, reason: 'Live action schema has not been compiled yet.' });
      continue;
    }
    const prompts = generateOnboardingPrompts(record, '', adapter);
    for (const result of auditOnboardingPrompts(record, prompts, adapter)) cases.push({
      ...result,
      category: 'onboarded-module-command',
      moduleId: record.moduleId,
      status: result.status === 'pass' ? 'pass' : 'fail',
    });
  }
  if (!cases.length) cases.push({ id: 'onboarded-modules:none', status: 'skipped', reason: 'No modules have been onboarded on this machine.' });
  return { cases };
}

export async function auditCorrectedCommands({ databasePath = DEFAULT_ONBOARDING_DATABASE, languageMemoryPath = DEFAULT_LANGUAGE_MEMORY } = {}) {
  const [database, memory] = await Promise.all([readModuleOnboardingDatabase(databasePath), readLanguageMemory(languageMemoryPath)]);
  const records = Object.values(database.modules || {});
  const corrected = (memory.examples || []).filter((item) => item.corrected && item.moduleId && item.actionId);
  const cases = corrected.map((example) => {
    const record = database.modules?.[example.moduleId];
    if (!record?.compiledAdapter) return { id: `correction:${example.key}`, status: 'pending', moduleId: example.moduleId, actionId: example.actionId, prompt: example.original, reason: 'The corrected module does not have a compiled live schema yet.' };
    const prompt = withLocation(example.original);
    const routed = resolveBatchModule(prompt, example.moduleId, records);
    const interpretation = [example.original, example.canonicalCommand].filter(Boolean)
      .map(withLocation).map((candidate) => interpretKnownDynamicCommand(candidate, record.compiledAdapter)).find(Boolean);
    const actualActionId = interpretation?.actionId || null;
    const passed = routed === example.moduleId && actualActionId === example.actionId;
    return {
      id: `correction:${example.key}`, category: 'corrected-command', moduleId: example.moduleId, prompt: example.original,
      expectedActionId: example.actionId, actualActionId, actualModuleId: routed || null, status: passed ? 'pass' : 'fail',
      ...(passed ? {} : { reason: `Expected ${example.moduleId}/${example.actionId}, received ${routed || 'no module'}/${actualActionId || 'no action'}.` }),
    };
  });
  if (!cases.length) cases.push({ id: 'corrected-commands:none', status: 'skipped', reason: 'No user corrections have been recorded yet.' });
  return { cases };
}
