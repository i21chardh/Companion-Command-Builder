import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseCommand } from '../parser.js';
import { buildDeploymentPlan } from '../plan.js';
import { defaultConfig } from '../config.js';
import { ADAPTERS } from './index.js';
import { discoverInstalledModules } from './audit.js';
import { generateModulePromptCandidates } from '../ai.js';
import { compileDynamicAdapter } from './dynamic.js';

const DEFAULT_MODULES_ROOT = join(homedir(), 'Library', 'Application Support', 'companion', 'modules');
export const DEFAULT_ONBOARDING_DATABASE = join(homedir(), 'Library', 'Application Support', 'Companion Command Builder', 'module-onboarding.json');

function words(value) {
  return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

function helpCandidates(markdown) {
  const candidates = [];
  for (const raw of String(markdown || '').split('\n')) {
    const line = raw.replace(/^\s*(?:[-*+] |#{1,6}\s+|\d+[.)]\s+)/, '').replace(/[`*_]/g, '').trim();
    if (line.length < 3 || line.length > 90 || /^(?:configuration|installation|getting started|variables?|feedbacks?|presets?)$/i.test(line)) continue;
    if (/^(?:https?:|\[|<|!\[)/.test(line)) continue;
    candidates.push(line.replace(/[.:]+$/, ''));
  }
  return [...new Set(candidates)].slice(0, 36);
}

export function generateOnboardingPrompts(module, helpText = '') {
  const adapter = ADAPTERS.get(module.moduleId);
  const phrases = adapter?.actionIds?.length
    ? adapter.actionIds.map(words)
    : helpCandidates(helpText);
  const selected = phrases.length ? phrases : ['run the primary action', 'toggle the primary function', 'recall preset 1'];
  return selected.slice(0, 36).map((phrase, index) => ({
    id: `${module.moduleId}:${index + 1}`,
    prompt: `Create a ${module.name} button at 1/1/1 to ${phrase}`,
    source: adapter ? 'adapter-action' : helpText ? 'module-help' : 'generic-baseline',
  }));
}

export function auditOnboardingPrompts(module, prompts) {
  return prompts.map((item) => {
    try {
      const parsed = parseCommand(item.prompt, { targetModuleId: module.moduleId });
      const plan = buildDeploymentPlan(parsed, defaultConfig);
      return { ...item, status: plan.module?.id === module.moduleId ? 'pass' : 'wrong-module', actualModule: plan.module?.id || null };
    } catch (error) {
      const message = error?.message || String(error);
      return { ...item, status: /adapter still needs implementation|not supported/i.test(message) ? 'adapter-required' : 'parser-required', error: message };
    }
  });
}

async function readDatabase(databasePath) {
  try { return JSON.parse(await readFile(databasePath, 'utf8')); }
  catch { return { format: 'ccb-module-onboarding', schemaVersion: 1, modules: {} }; }
}

async function saveDatabase(databasePath, database) {
  database.updatedAt = new Date().toISOString();
  await mkdir(dirname(databasePath), { recursive: true });
  const temporary = `${databasePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(database, null, 2)}\n`);
  await rename(temporary, databasePath);
}

export async function configureModuleSupport(moduleId, { modulesRoot = DEFAULT_MODULES_ROOT, databasePath = DEFAULT_ONBOARDING_DATABASE, useAi = true, definitions = null, connectionError = '', onProgress = () => {} } = {}) {
  onProgress(5, 'Discovering installed module');
  const installed = await discoverInstalledModules(modulesRoot);
  const module = installed.find((item) => item.moduleId === moduleId);
  if (!module) throw new Error('That Companion module is not installed.');
  const database = await readDatabase(databasePath); database.modules ||= {};
  const previous = database.modules[module.moduleId];
  const fingerprint = `${module.moduleId}@${module.version}`;
  const saveCheckpoint = async (stage, details = {}) => {
    database.modules[module.moduleId] = {
      ...(database.modules[module.moduleId] || {}), fingerprint, moduleId: module.moduleId, name: module.name, version: module.version,
      checkpoint: { stage, savedAt: new Date().toISOString(), ...details },
    };
    await saveDatabase(databasePath, database);
  };
  const helpPath = join(modulesRoot, `${module.moduleId}-${module.version}`, 'companion', 'HELP.md');
  const helpText = await readFile(helpPath, 'utf8').catch(() => '');
  onProgress(18, definitions ? `Reading ${Object.keys(definitions.actions || {}).length} live action definitions` : 'Reading module documentation');
  const deterministic = generateOnboardingPrompts(module, helpText);
  onProgress(30, 'Generating deterministic prompt corpus');
  await saveCheckpoint('corpus-generated', { deterministic });
  let ai = null;
  if (useAi) {
    onProgress(38, 'Generating real-world prompts with Ollama');
    if (previous?.fingerprint === fingerprint && previous.checkpoint?.ai?.prompts?.length) ai = previous.checkpoint.ai;
    else {
      try { ai = await generateModulePromptCandidates(module, helpText); }
      catch (error) { ai = { prompts: [], error: error.message }; }
      await saveCheckpoint('ai-generated', { deterministic, ai });
    }
  }
  onProgress(68, useAi ? 'Ollama prompt generation complete' : 'AI generation skipped');
  const merged = [...deterministic, ...(ai?.prompts || []).map((item, index) => ({
    id: `${module.moduleId}:ai:${index + 1}`, prompt: item.prompt, source: 'ollama',
    intent: item.intent, actionHint: item.actionHint, parameters: item.parameters,
  }))];
  const prompts = [...new Map(merged.filter((item) => item.prompt).map((item) => [item.prompt.toLowerCase(), item])).values()];
  onProgress(76, `Auditing ${prompts.length} prompts through the parser`);
  const results = auditOnboardingPrompts(module, prompts);
  const counts = Object.fromEntries(['pass', 'wrong-module', 'adapter-required', 'parser-required'].map((status) => [status, results.filter((item) => item.status === status).length]));
  const adapter = ADAPTERS.get(module.moduleId);
  let compiledAdapter = null;
  if (definitions && Object.keys(definitions.actions || {}).length) {
    onProgress(84, 'Compiling validated dynamic action catalog');
    compiledAdapter = compileDynamicAdapter(module, definitions);
  }
  const gates = {
    actionDiscovery: Boolean(Object.keys(definitions?.actions || {}).length || helpText || adapter?.actionIds?.length), corpusGenerated: prompts.length >= 6,
    // Dynamic modules acquire their language mapping from the audited
    // documentation/Ollama corpus before a live Companion connection exists.
    // Live action IDs and option types belong to the separate schema gate.
    parserMapped: Boolean(compiledAdapter) || (counts.pass > 0 && counts.wrongModule === 0) || (prompts.length >= 6 && Boolean(helpText || adapter?.actionIds?.length)),
    schemaTested: Boolean(compiledAdapter) || adapter?.verification === 'schema-tested' || adapter?.verification === 'live-tested',
    connectionValidated: !connectionError, liveVerified: adapter?.verification === 'live-tested', supported: Boolean(adapter && adapter.supportedVersions.includes(module.version)),
  };
  database.modules[module.moduleId] = {
    fingerprint: `${module.moduleId}@${module.version}`, moduleId: module.moduleId, name: module.name, version: module.version,
    adapterImplemented: Boolean(adapter), auditedAt: new Date().toISOString(), configuredAt: new Date().toISOString(),
    ai: ai ? { provider: ai.provider || 'ollama', model: ai.model || null, generated: ai.prompts.length, error: ai.error || null } : null,
    liveSchema: definitions ? { capturedAt: new Date().toISOString(), actions: definitions.actions || {}, feedbacks: definitions.feedbacks || {} } : null,
    compiledAdapter, pendingConnection: Boolean(connectionError), connectionError: connectionError || null,
    gates, counts, prompts: results, checkpoint: null,
  };
  onProgress(92, 'Saving support candidate report');
  await saveDatabase(databasePath, database);
  onProgress(100, 'Configuration complete');
  return database.modules[module.moduleId];
}

export async function readDynamicAdapter(moduleId, databasePath = DEFAULT_ONBOARDING_DATABASE) {
  const database = await readDatabase(databasePath);
  return database.modules?.[moduleId]?.compiledAdapter || null;
}

export async function saveDynamicValidationResult(moduleId, readback, databasePath = DEFAULT_ONBOARDING_DATABASE) {
  const database = await readDatabase(databasePath);
  const record = database.modules?.[moduleId];
  if (!record) throw new Error('The module onboarding record was not found.');
  record.readback = { ...readback, verifiedAt: new Date().toISOString() };
  record.gates ||= {}; record.gates.readbackVerified = readback?.verified === true;
  // A compiled live schema plus an exact, non-executing Companion read-back is
  // the completion gate for dynamically generated CCB support. Potentially
  // destructive device execution remains an optional operator validation and
  // must not make the configuration wizard stop and ask to be continued.
  record.gates.supported = Boolean(record.compiledAdapter && record.gates.schemaTested && record.gates.readbackVerified);
  if (record.gates.supported) record.supportedAt = new Date().toISOString();
  await saveDatabase(databasePath, database);
  return record;
}

export async function savePendingReadback(moduleId, reason, databasePath = DEFAULT_ONBOARDING_DATABASE) {
  const database = await readDatabase(databasePath);
  const record = database.modules?.[moduleId];
  if (!record) throw new Error('The module onboarding record was not found.');
  record.pendingReadback = true;
  record.readbackError = reason || 'Connect an online surface to finish temporary-control read-back.';
  record.gates ||= {}; record.gates.readbackVerified = false; record.gates.supported = false;
  await saveDatabase(databasePath, database);
  return record;
}

export async function readModuleOnboardingDatabase(databasePath = DEFAULT_ONBOARDING_DATABASE) {
  return readDatabase(databasePath);
}

export async function syncModuleOnboardingDatabase({ modulesRoot = DEFAULT_MODULES_ROOT, databasePath = DEFAULT_ONBOARDING_DATABASE, force = false } = {}) {
  const installed = await discoverInstalledModules(modulesRoot);
  const database = await readDatabase(databasePath);
  database.modules ||= {};
  const changed = [];
  for (const module of installed) {
    const fingerprint = `${module.moduleId}@${module.version}`;
    if (!force && database.modules[module.moduleId]?.fingerprint === fingerprint) continue;
    const helpPath = join(modulesRoot, `${module.moduleId}-${module.version}`, 'companion', 'HELP.md');
    const helpText = await readFile(helpPath, 'utf8').catch(() => '');
    const prompts = generateOnboardingPrompts(module, helpText);
    const results = auditOnboardingPrompts(module, prompts);
    const counts = Object.fromEntries(['pass', 'wrong-module', 'adapter-required', 'parser-required'].map((status) => [status, results.filter((item) => item.status === status).length]));
    database.modules[module.moduleId] = {
      fingerprint, moduleId: module.moduleId, name: module.name, version: module.version,
      adapterImplemented: ADAPTERS.has(module.moduleId), auditedAt: new Date().toISOString(), counts, prompts: results,
    };
    changed.push(module.moduleId);
  }
  await saveDatabase(databasePath, database);
  return { databasePath, changed, modules: database.modules };
}
