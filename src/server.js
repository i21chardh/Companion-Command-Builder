#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { basename, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { mergeConfig } from './config.js';
import { parseCommand } from './parser.js';
import { buildDeploymentPlan } from './plan.js';
import { actionManifest, addCompanionPage, addSurfaceLayerScroll, arrangeNonOverlappingSurfaces, cancelConnectionDraft, ccbSurface, clearSurfacePage, createConnectionDraft, deleteSurfaceButton, deployPlan, discoverConnectionDefinitions, discoverConnections, discoverPageButtons, discoverPages, discoverSurfaceButtonGraphics, discoverSurfaces, initializeSurfaceEncoders, moveExistingButton, pressSurfaceButton, readConnectionConfig, registerSharedSurfacePresence, removeCompanionPage, saveConnectionDraft, setCompanionSurfacePage, surfacesOverlap, transferSurfaceButton, updateExistingButton, validateDynamicAdapterReadback } from './companion.js';
import { aiStatus, bridgeCommand, interpretDynamicModuleCommand } from './ai.js';
import { applyDefaultLocation, commandHasLocation, duplicateLocations, expandLayoutCommand, splitBatchCommands } from './batch.js';
import { buildEditPlan, isEditCommand, parseEditCommand } from './edit.js';
import { adapterDevelopmentQueue, buildConnectionRegistry } from './adapters/index.js';
import { discoverInstalledModules } from './adapters/audit.js';
import { configureModuleSupport, readDynamicAdapter, readModuleOnboardingDatabase, saveDynamicValidationResult, savePendingReadback, syncModuleOnboardingDatabase } from './adapters/onboarding.js';
import { buildDynamicPlan, validateDynamicPlanAvailability } from './adapters/dynamic.js';
import { languageExamples, rememberSuccessfulCommand } from './language-memory.js';
import { provisionalAdapter } from './adapters/provisional.js';
import { resolveBatchModule } from './module-routing.js';
import { deterministicModuleCandidates } from './module-intent-routing.js';
import { interpretKnownDynamicCommand } from './deterministic-dynamic.js';
import { clearOscReceiverEvents, oscReceiverStatus, selfTestOscReceiver, startOscReceiver, stopOscReceiver } from './osc-test-receiver.js';
import { clearSystemLog, readSystemLog, systemLogPath, writeSystemLog } from './system-log.js';
import { loadPresetFile, savePresetFile, validPresetPath } from './preset-store.js';
import { coordinatorAddress, createCustodyRegistry } from './collaboration.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.env.COMPANION_BUILDER_PORT || 3100);
const coordinationPort = Number(process.env.CCB_COORDINATION_PORT || 3110);
const config = mergeConfig();
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const execFileAsync = promisify(execFile);
let dictationRunning = false;
const moduleSupportJobs = new Map();
const custodyRegistry = createCustodyRegistry();

process.on('uncaughtException', (error) => {
  writeSystemLog('fatal', 'server-uncaught-exception', { message: error.message, stack: error.stack }).finally(() => process.exit(1));
});
process.on('unhandledRejection', (reason) => {
  writeSystemLog('error', 'server-unhandled-rejection', { message: reason?.message || String(reason), stack: reason?.stack }).catch(() => {});
});

function applyDynamicSupport(registry, onboarding) {
  return registry.map((entry) => {
    const record = onboarding?.modules?.[entry.moduleId];
    // A documentation/prompt audit is useful evidence, but it is not an
    // executable command adapter. Never advertise runnable language support
    // unless onboarding compiled a live schema or CCB ships a validated
    // built-in adapter for the exact module.
    const executableAdapter = record?.compiledAdapter || provisionalAdapter(entry.moduleId);
    const languageSupported = Boolean(record?.configuredAt && executableAdapter && (record.gates?.parserMapped || record.gates?.actionDiscovery));
    if (!languageSupported) return entry;
    const capabilities = executableAdapter.actions?.map((action) => action.name || action.id)
      || record.prompts?.map((prompt) => prompt.actionHint || prompt.intent || String(prompt.prompt || '').replace(/^Create .*? to /i, '')).filter(Boolean);
    return {
      ...entry,
      adapter: {
        ...entry.adapter,
        status: 'supported', compatible: true, verification: record.gates?.readbackVerified ? 'companion-readback' : 'language-mapped',
        displayName: record.name || entry.label || entry.moduleId,
        capabilities: [...new Set(capabilities || [])].slice(0, 8),
        graphics: entry.adapter?.graphics || [],
      },
    };
  });
}

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validCustodyAction(action) { return ['status', 'announce', 'acquire', 'heartbeat', 'release'].includes(action); }

async function custodyRequest(input) {
  if (!validCustodyAction(input?.action)) throw new Error('Unknown workspace custody action.');
  if (input.action === 'status') return custodyRegistry.snapshot();
  return custodyRegistry[input.action](input);
}

const custodyServer = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') return json(response, 200, { online: true, service: 'ccb-workspace-custody' });
    if (request.method !== 'POST' || request.url !== '/api/custody') return json(response, 404, { error: 'Not found' });
    return json(response, 200, await custodyRequest(await body(request)));
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
});
custodyServer.on('error', (error) => {
  writeSystemLog('warn', 'custody-coordinator-unavailable', { message: error.message, port: coordinationPort }).catch(() => {});
});
custodyServer.listen(coordinationPort, '0.0.0.0', () => {
  writeSystemLog('info', 'custody-coordinator-started', { port: coordinationPort }).catch(() => {});
});

async function macSavePresetDialog(suggestedName) {
  const script = `on run argv
set chosenFile to choose file name with prompt "Save Companion Command Builder layout" default name (item 1 of argv)
return POSIX path of chosenFile
end run`;
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script, suggestedName]);
  return stdout.trim();
}

async function macLoadPresetDialog() {
  const script = `set chosenFile to choose file with prompt "Load Companion Command Builder layout"
return POSIX path of chosenFile`;
  const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script]);
  return stdout.trim();
}

async function planCommand(command, input) {
  const requestConfig = mergeConfig({ companion: { address: input.address ? `http://${input.address.replace(/^https?:\/\//, '')}` : config.companion.address } });
  if (isEditCommand(command)) {
    const parsedEdit = parseEditCommand(command);
    const address = String(input.address || '127.0.0.1:8000');
    if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) throw new Error('Invalid Companion address.');
    const surfaces = await discoverSurfaces(address);
    const targetSurface = surfaces.find((surface) => surface.id === input.surfaceId);
    const buttons = await discoverPageButtons(address, parsedEdit.location.page);
    const existing = buttons.find((button) => button.row === parsedEdit.location.row && button.column === parsedEdit.location.column);
    const plan = buildEditPlan(parsedEdit, existing, { product: 'Bitfocus Companion', version: config.companion.version, address: requestConfig.companion.address }, requestConfig.module);
    if (plan.kind === 'replace-button') plan.actions = actionManifest(plan.button.action);
    plan.surface = { template: input.surface || 'mk2' };
    plan.ai = null;
    return plan;
  }
  if (input.moduleId) {
    const dynamicAdapter = await readDynamicAdapter(input.moduleId) || provisionalAdapter(input.moduleId);
    if (dynamicAdapter) {
      const learned = await languageExamples(command, input.moduleId);
      const deterministic = interpretKnownDynamicCommand(command, dynamicAdapter);
      const interpretation = deterministic || await interpretDynamicModuleCommand(command, dynamicAdapter, learned);
      const plan = buildDynamicPlan(dynamicAdapter, interpretation, {
        product: 'Bitfocus Companion', version: config.companion.version, address: requestConfig.companion.address,
      });
      plan.surface = { template: input.surface || 'mk2' };
      plan.actions = actionManifest(plan.button.action);
      plan.ai = deterministic ? null : { used: true, model: aiStatus().model, provider: 'ollama', note: interpretation.note };
      return plan;
    }
  }
  let parsed;
  let ai = null;
  try { parsed = parseCommand(command, { defaultPage: config.companion.defaultPage, targetModuleId: input.moduleId || '' }); }
  catch (parserError) {
    if (input.moduleId !== 'digico-osc' || parserError.details?.aiEligible === false || input.aiEnabled === false) throw parserError;
    const learned = await languageExamples(command, 'digico-osc');
    const interpretation = await bridgeCommand(command, parserError, learned);
    parsed = parseCommand(interpretation.canonicalCommand, { defaultPage: config.companion.defaultPage, targetModuleId: input.moduleId || '' });
    parsed.sourceText = command.trim();
    ai = { used: true, interpretation: interpretation.canonicalCommand, note: interpretation.note, model: interpretation.model, provider: interpretation.provider };
  }
  const plan = buildDeploymentPlan(parsed, requestConfig);
  plan.surface = { template: input.surface || 'mk2' };
  plan.actions = actionManifest(plan.button.action);
  plan.ai = ai;
  return plan;
}

createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/dictate') {
      if (dictationRunning) return json(response, 409, { error: 'Dictation is already listening.' });
      const helper = process.env.COMPANION_BUILDER_SPEECH_HELPER;
      if (!helper) return json(response, 501, { error: 'Native Apple dictation is available in the packaged macOS application.' });
      const input = await body(request).catch(() => ({}));
      const deviceUid = String(input.deviceUid || '');
      const channelIndex = input.channelIndex === '' || input.channelIndex == null ? null : Number(input.channelIndex);
      if (deviceUid && deviceUid.length > 256) return json(response, 400, { error: 'Invalid audio input device.' });
      if (channelIndex != null && (!Number.isInteger(channelIndex) || channelIndex < 0 || channelIndex > 63)) return json(response, 400, { error: 'Invalid audio input channel.' });
      dictationRunning = true;
      try {
        const args = ['--dictate', ...(deviceUid ? ['--audio-device', deviceUid] : []), ...(channelIndex != null ? ['--audio-channel', String(channelIndex)] : [])];
        let stdout;
        try { ({ stdout } = await execFileAsync(helper, args, { timeout: 25000, maxBuffer: 1024 * 1024 })); }
        catch (helperError) {
          const diagnostic = String(helperError.stderr || helperError.message || '');
          const audioFormatFailure = /Input HW format and tap format not matching|coreaudio|avfaudio/i.test(diagnostic);
          return json(response, 400, { error: audioFormatFailure ? 'The selected audio interface changed formats while opening. Refresh Speech Input, confirm its sample rate in Audio MIDI Setup, and try again.' : 'Apple Speech could not start the selected audio input. Refresh the device list or choose System Default Input.' });
        }
        const result = JSON.parse(stdout.trim().split('\n').at(-1));
        if (!result.ok) return json(response, 400, { error: result.error || 'Dictation failed.' });
        return json(response, 200, { transcript: result.transcript });
      } finally { dictationRunning = false; }
    }

    if (request.method === 'GET' && request.url === '/api/audio-inputs') {
      const helper = process.env.COMPANION_BUILDER_SPEECH_HELPER;
      if (!helper) return json(response, 200, { devices: [], packaged: false });
      const { stdout } = await execFileAsync(helper, ['--list-audio-inputs'], { timeout: 5000, maxBuffer: 1024 * 1024 });
      return json(response, 200, { devices: JSON.parse(stdout || '[]'), packaged: true });
    }

    if (request.method === 'POST' && request.url === '/api/parse') {
      const input = await body(request);
      if (!commandHasLocation(input.command) && !input.defaultLocation) throw new Error('The selected surface and layer have no open button positions. Choose another layer, clear a cell, or include an explicit PAGE/ROW/COLUMN location.');
      input.command = applyDefaultLocation(input.command, input.defaultLocation);
      const enabledModules = Array.isArray(input.enabledModuleIds) ? new Set(input.enabledModuleIds.map(String)) : null;
      const onboarding = await readModuleOnboardingDatabase();
      let routedModuleId = resolveBatchModule(input.command, input.moduleId, Object.values(onboarding.modules || {}));
      if (enabledModules && routedModuleId && !enabledModules.has(routedModuleId)) throw new Error(`${routedModuleId} is disabled in the CCB Connection Registry. Enable it or choose another module.`);
      if (!routedModuleId && !isEditCommand(input.command)) {
        const moduleIds = enabledModules?.size ? [...enabledModules] : Object.keys(onboarding.modules || {});
        const modules = await Promise.all(moduleIds.map(async (moduleId) => ({
          moduleId, adapter: await readDynamicAdapter(moduleId) || provisionalAdapter(moduleId),
        })));
        const candidates = deterministicModuleCandidates(input.command, modules);
        if (candidates.length === 1) routedModuleId = candidates[0];
        else if (candidates.length > 1) throw new Error(`This command matches multiple enabled modules: ${candidates.join(', ')}. Name the module in the command or select it as the Target Module.`);
        else throw new Error('CCB could not identify a target module. Name the module in the command or select it as the Target Module. No module was assumed.');
      }
      const commands = expandLayoutCommand(input.command, routedModuleId);
      if (!commands.length) return json(response, 400, { error: 'Enter at least one button command.' });
      const routedInput = { ...input, moduleId: routedModuleId };
      const plans = [];
      for (let index = 0; index < commands.length; index += 1) {
        try { plans.push(await planCommand(commands[index], routedInput)); }
        catch (error) { throw new Error(commands.length > 1 ? `Button ${index + 1}: ${error.message}` : error.message); }
      }
      const duplicates = duplicateLocations(plans);
      if (duplicates.length) throw new Error(`Batch contains duplicate button location${duplicates.length === 1 ? '' : 's'}: ${duplicates.join(', ')}.`);
      await Promise.all(plans.map((plan, index) => rememberSuccessfulCommand({
        command: commands[index], moduleId: routedInput.moduleId || plan.module?.id || '',
        actionId: plan.button?.action?.actionId || plan.button?.action?.steps?.[0]?.actionId || '',
        canonicalCommand: plan.ai?.interpretation || '', corrected: Boolean(plan.ai?.interpretation),
      }).catch(() => null)));
      return json(response, 200, plans.length === 1 ? plans[0] : { batch: true, plans });
    }

    if (request.method === 'POST' && request.url === '/api/language-memory/correct') {
      const input = await body(request);
      if (!String(input.command || '').trim() || !String(input.actionId || '').trim()) return json(response, 400, { error: 'A command and corrected action ID are required.' });
      return json(response, 200, { learned: await rememberSuccessfulCommand({ command: input.command, moduleId: String(input.moduleId || ''), actionId: String(input.actionId), canonicalCommand: String(input.canonicalCommand || ''), corrected: true }) });
    }

    if (request.method === 'POST' && request.url === '/api/deploy') {
      const input = await body(request);
      const plans = Array.isArray(input.plans) ? input.plans : input.plan?.button ? [input.plan] : [];
      if ((!plans.length && !input.overwriteAll) || plans.some((plan) => !plan?.button)) return json(response, 400, { error: 'At least one previewed button plan is required.' });
      const address = String(input.address || '127.0.0.1:8000');
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      const surfaces = await discoverSurfaces(address);
      const targetSurface = surfaces.find((surface) => surface.id === input.surfaceId);
      if (!targetSurface) return json(response, 400, { error: input.surfaceId ? 'The selected Stream Deck is no longer connected.' : 'Select a connected Stream Deck before deploying.' });
      const duplicates = duplicateLocations(plans);
      if (duplicates.length) return json(response, 400, { error: `Batch contains duplicate locations: ${duplicates.join(', ')}.` });
      const dynamicPlans = plans.filter((plan) => plan.button?.action?.family === 'dynamic');
      if (dynamicPlans.length) {
        const connections = await discoverConnections(address);
        const schemas = new Map();
        for (const plan of dynamicPlans) {
          const moduleId = plan.module?.id;
          const connection = connections.find((item) => item.moduleId === moduleId && item.enabled !== false && (!plan.module?.connectionLabel || item.label === plan.module.connectionLabel));
          if (!connection) throw new Error(`No active ${moduleId} connection was found in Companion.`);
          if (!schemas.has(connection.id)) schemas.set(connection.id, await discoverConnectionDefinitions(address, connection.id));
          validateDynamicPlanAvailability(plan, schemas.get(connection.id), connection);
        }
      }
      for (const plan of plans) {
        const location = plan.button.location;
        const localTransfer = input.overwriteAll || input.mergeAll;
        const compatible = localTransfer
          ? location.row >= 0 && location.row < targetSurface.rows && location.column >= 0 && location.column < targetSurface.columns
          : location.row >= targetSurface.yOffset && location.row < targetSurface.yOffset + targetSurface.rows && location.column >= targetSurface.xOffset && location.column < targetSurface.xOffset + targetSurface.columns;
        if (!compatible) return json(response, 400, { error: `${location.page}/${location.row}/${location.column} is outside the selected Stream Deck.` });
      }
      const companionPlans = plans.map((source) => {
        const plan = structuredClone(source);
        if (input.overwriteAll || input.mergeAll) {
          plan.button.location.row += targetSurface.yOffset;
          plan.button.location.column += targetSurface.xOffset;
        }
        if ((input.overwriteAll || input.mergeAll) && plan.move?.from) {
          plan.move.from.row += targetSurface.yOffset;
          plan.move.from.column += targetSurface.xOffset;
        }
        return plan;
      });
      if ((input.overwriteAll || input.mergeAll) && companionPlans.some((plan) => ['edit-button', 'move-button', 'replace-button'].includes(plan.kind))) return json(response, 400, { error: 'Full-layout transfer accepts new Builder buttons only.' });
      const hasEdits = companionPlans.some((plan) => ['edit-button', 'replace-button'].includes(plan.kind));
      const hasMoves = companionPlans.some((plan) => plan.kind === 'move-button');
      const hasCreates = companionPlans.some((plan) => !['edit-button', 'move-button', 'replace-button'].includes(plan.kind));
      if ([hasEdits, hasMoves, hasCreates].filter(Boolean).length > 1) return json(response, 400, { error: 'Create, edit, and move operations cannot be mixed in one batch.' });
      if (hasMoves && plans.length > 1) return json(response, 400, { error: 'Move one existing button at a time.' });
      const pages = [...new Set(companionPlans.map((plan) => plan.button.location.page))];
      for (const page of input.overwriteAll || input.mergeAll ? [] : pages) {
        const occupied = await discoverPageButtons(address, page);
        const conflict = companionPlans.find((plan) => plan.button.location.page === page && ['edit-button', 'replace-button'].includes(plan.kind) !== occupied.some((button) => button.row === plan.button.location.row && button.column === plan.button.location.column));
        if (conflict) {
          const local = plans[companionPlans.indexOf(conflict)]?.button.location || conflict.button.location;
          return json(response, 400, { error: conflict.kind === 'edit-button' ? `No Companion button exists at ${local.page}/${local.row}/${local.column}.` : `Companion location ${local.page}/${local.row}/${local.column} is not empty.` });
        }
      }
      let overwriteSummary = null;
      if (input.overwriteAll) {
        let companionPages = await discoverPages(address);
        const desiredPageCount = Math.max(1, Number(input.desiredPageCount) || companionPages.length || 1);
        while (companionPages.length < desiredPageCount) {
          const pageNumber = companionPages.length + 1;
          await addCompanionPage(address, pageNumber, `Layer ${pageNumber}`);
          companionPages = await discoverPages(address);
        }
        while (companionPages.length > desiredPageCount && companionPages.length > 1) {
          await removeCompanionPage(address, companionPages.length);
          companionPages = await discoverPages(address);
        }
        let cleared = 0;
        for (const page of companionPages) cleared += (await clearSurfacePage(address, targetSurface, page.pageNumber)).count;
        overwriteSummary = { cleared, pagesCleared: companionPages.length, pagesMatched: desiredPageCount };
      }
      let deployPlans = companionPlans;
      let mergeSummary = null;
      if (input.mergeAll) {
        const companionPages = await discoverPages(address);
        const occupied = new Set();
        for (const page of companionPages) {
          for (const button of await discoverPageButtons(address, page.pageNumber)) occupied.add(`${page.pageNumber}/${button.row}/${button.column}`);
        }
        const free = [];
        for (const page of companionPages) for (let row = 1; row <= targetSurface.rows; row += 1) for (let column = 1; column <= targetSurface.columns; column += 1) {
          const slot = { page: page.pageNumber, row: row + targetSurface.yOffset - 1, column: column + targetSurface.xOffset - 1 };
          if (!occupied.has(`${slot.page}/${slot.row}/${slot.column}`)) free.push(slot);
        }
        const assigned = [];
        let relocated = 0;
        for (const source of companionPlans) {
          const preferred = source.button.location;
          let index = free.findIndex((slot) => slot.page === preferred.page && slot.row === preferred.row && slot.column === preferred.column);
          if (index < 0) index = 0;
          if (!free.length) break;
          const [slot] = free.splice(index, 1);
          const plan = structuredClone(source);
          if (slot.page !== preferred.page || slot.row !== preferred.row || slot.column !== preferred.column) relocated += 1;
          plan.button.location = slot;
          assigned.push(plan);
        }
        deployPlans = assigned;
        mergeSummary = { requested: companionPlans.length, skipped: companionPlans.length - assigned.length, relocated, available: free.length };
        if (!deployPlans.length) return json(response, 409, { error: `No empty positions are available on ${targetSurface.name}. Existing Companion buttons were preserved.` });
      }
      const results = [];
      try {
        for (const plan of deployPlans) {
          const result = plan.kind === 'edit-button'
            ? await updateExistingButton(address, plan)
            : plan.kind === 'move-button'
              ? await moveExistingButton(address, plan)
              : await deployPlan(plan, { address, connectionLabel: input.connectionLabel || null, overwrite: plan.kind === 'replace-button', targetSurface });
          results.push(plan.kind === 'replace-button' ? { ...result, updated: true, replaced: true } : result);
        }
      } catch (error) {
        if (results.length && hasEdits) {
          for (const plan of deployPlans.slice(0, results.length).reverse()) await updateExistingButton(address, { ...plan, edit: { changes: plan.edit.original } }).catch(() => {});
        } else if (results.length) {
          const { clearPlanLocations } = await import('./companion.js');
          await clearPlanLocations(address, deployPlans.slice(0, results.length)).catch(() => {});
        }
        throw error;
      }
      if (input.overwriteAll) return json(response, 200, { overwritten: true, count: results.length, results, ...overwriteSummary });
      if (input.mergeAll) return json(response, 200, { merged: true, count: results.length, results, ...mergeSummary });
      return json(response, 200, plans.length === 1 ? results[0] : { deployed: !hasEdits, updated: hasEdits, batch: true, count: results.length, results });
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/companion-surfaces')) {
      const url = new URL(request.url, 'http://127.0.0.1');
      const address = url.searchParams.get('address') || '127.0.0.1:8000';
      const satelliteAddress = url.searchParams.get('satelliteAddress') || '';
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      const surfaces = await discoverSurfaces(address, { satelliteAddress });
      return json(response, 200, { surfaces: surfaces.map(ccbSurface), overlapping: surfacesOverlap(surfaces) });
    }

    if (request.method === 'POST' && request.url === '/api/companion-surfaces/arrange') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      const result = await arrangeNonOverlappingSurfaces(address);
      return json(response, 200, { ...result, surfaces: result.surfaces.map(ccbSurface) });
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/companion-connections')) {
      const address = new URL(request.url, 'http://127.0.0.1').searchParams.get('address') || '127.0.0.1:8000';
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      const onboarding = await readModuleOnboardingDatabase().catch(() => ({ modules: {} }));
      return json(response, 200, { connections: applyDynamicSupport(buildConnectionRegistry(await discoverConnections(address)), onboarding) });
    }
    if (request.method === 'GET' && request.url === '/api/installed-modules') {
      const modules = await discoverInstalledModules();
      const onboarding = await syncModuleOnboardingDatabase().catch(() => ({ modules: {} }));
      return json(response, 200, { modules: modules.map((module) => ({
        ...module,
        adapter: applyDynamicSupport(buildConnectionRegistry([{ ...module, id: module.moduleId, label: module.name, moduleVersionId: module.version, enabled: true }]), onboarding)[0].adapter,
        onboarding: onboarding.modules?.[module.moduleId] || null,
      })) });
    }
    if (request.method === 'POST' && request.url === '/api/presets/save') {
      const input = await body(request);
      let path = input.path ? validPresetPath(input.path) : '';
      if (!path) {
        const rawName = String(input.suggestedName || 'Companion-Layout.ccb-layout').replace(/[^a-z0-9 ._-]/gi, '_');
        const suggestedName = /\.(?:json|ccb-layout)$/i.test(rawName) ? rawName : `${rawName}.ccb-layout`;
        path = validPresetPath(await macSavePresetDialog(suggestedName));
      }
      const document = input.document;
      await savePresetFile(path, document);
      return json(response, 200, { path, name: basename(path) });
    }
    if (request.method === 'POST' && request.url === '/api/presets/load') {
      const path = validPresetPath(await macLoadPresetDialog());
      const document = await loadPresetFile(path);
      return json(response, 200, { path, name: basename(path), document });
    }
    if (request.method === 'POST' && request.url === '/api/module-onboarding/rescan') {
      return json(response, 200, await syncModuleOnboardingDatabase({ force: true }));
    }
    if (request.method === 'POST' && request.url === '/api/module-onboarding/configure') {
      const input = await body(request);
      const moduleId = String(input.moduleId || '');
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(moduleId)) return json(response, 400, { error: 'A valid installed module ID is required.' });
      const jobId = randomUUID();
      const job = { jobId, moduleId, status: 'running', percent: 1, stage: 'Queued', result: null, error: null };
      moduleSupportJobs.set(jobId, job);
      Promise.resolve().then(async () => {
        let definitions = null;
        let schemaError = null;
        if (input.connectionId && input.address) {
          for (let attempt = 1; attempt <= 3 && !definitions; attempt += 1) {
            Object.assign(job, { percent: 4 + attempt * 3, stage: `Reading live Companion action schema · attempt ${attempt} of 3` });
            try { definitions = await discoverConnectionDefinitions(String(input.address), String(input.connectionId)); }
            catch (error) { schemaError = error; if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 750)); }
          }
        }
        const result = await configureModuleSupport(moduleId, {
        useAi: input.useAi !== false,
        definitions,
        connectionError: definitions ? '' : schemaError?.message || (input.connectionId ? 'The connection did not return a live action schema.' : 'Add and enable a Companion connection to finish live schema validation.'),
        onProgress: (percent, stage) => Object.assign(job, { percent, stage }),
        });
        if (definitions && !result.compiledAdapter) throw new Error('Configuration could not compile the live action catalog returned by Companion.');
        if (input.readback && result.compiledAdapter && input.connectionId && input.surfaceId) {
          Object.assign(job, { percent: 95, stage: 'Creating temporary Companion read-back control' });
          const surfaces = await discoverSurfaces(String(input.address));
          const surface = surfaces.find((item) => item.id === input.surfaceId && item.connected !== false);
          if (!surface) throw new Error('The selected connected surface is unavailable for read-back validation.');
          result.readback = await validateDynamicAdapterReadback(String(input.address), String(input.connectionId), surface, Number(input.pageNumber || 1), result.compiledAdapter);
          result.gates.readbackVerified = true;
          const saved = await saveDynamicValidationResult(moduleId, result.readback);
          result.gates = saved.gates;
          result.supportedAt = saved.supportedAt;
        } else if (result.compiledAdapter && !result.gates.readbackVerified) {
          const saved = await savePendingReadback(moduleId, 'Connect an online Stream Deck surface to finish temporary-control read-back.');
          result.pendingReadback = true;
          result.readbackError = saved.readbackError;
          result.gates = saved.gates;
        }
        return result;
      }).then((result) => Object.assign(job, { status: 'complete', percent: 100, stage: 'Configuration complete', result }))
        .catch((error) => Object.assign(job, { status: 'error', stage: 'Configuration failed', error: error.message || String(error) }));
      return json(response, 202, { jobId });
    }
    if (request.method === 'GET' && request.url?.startsWith('/api/module-onboarding/status')) {
      const jobId = new URL(request.url, 'http://127.0.0.1').searchParams.get('id');
      const job = moduleSupportJobs.get(jobId);
      if (!job) return json(response, 404, { error: 'Support configuration job was not found.' });
      return json(response, 200, job);
    }
    if (request.method === 'POST' && request.url === '/api/companion-connections/draft') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      const modules = await discoverInstalledModules();
      const moduleInfo = modules.find((item) => item.moduleId === input.moduleId && (!input.version || item.version === input.version));
      if (!moduleInfo) return json(response, 404, { error: 'That connection module/version is not installed in this Companion instance.' });
      const label = String(input.label || '').trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(label)) return json(response, 400, { error: 'Connection labels may contain letters, numbers, underscores, and dashes.' });
      return json(response, 200, await createConnectionDraft(address, moduleInfo, label));
    }
    if (request.method === 'POST' && request.url === '/api/companion-connections/edit') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      const connectionId = String(input.connectionId || '');
      if (!connectionId) return json(response, 400, { error: 'A Companion connection ID is required.' });
      const connection = (await discoverConnections(address)).find((item) => item.id === connectionId);
      if (!connection) return json(response, 404, { error: 'That Companion connection is no longer available.' });
      return json(response, 200, { ...connection, ...await readConnectionConfig(address, connectionId), existing: true });
    }
    if (request.method === 'POST' && request.url === '/api/companion-connections/configure') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      if (!input.connectionId) return json(response, 400, { error: 'A Companion connection ID is required.' });
      if (input.cancel) return json(response, 200, await cancelConnectionDraft(address, String(input.connectionId)));
      return json(response, 200, await saveConnectionDraft(address, input));
    }
    if (request.method === 'GET' && request.url === '/api/adapter-catalog') {
      return json(response, 200, { adapters: adapterDevelopmentQueue() });
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/companion-pages')) {
      const address = new URL(request.url, 'http://127.0.0.1').searchParams.get('address') || '127.0.0.1:8000';
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      return json(response, 200, { pages: await discoverPages(address) });
    }

    if (request.method === 'POST' && request.url === '/api/companion-pages') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      if (input.action === 'add') {
        const pages = await discoverPages(address);
        const pageNumber = pages.length + 1;
        return json(response, 200, await addCompanionPage(address, pageNumber, `Layer ${pageNumber}`));
      }
      if (input.action === 'remove') {
        const pageNumber = Number(input.pageNumber);
        if (!Number.isInteger(pageNumber) || pageNumber < 1) return json(response, 400, { error: 'A valid layer number is required.' });
        return json(response, 200, await removeCompanionPage(address, pageNumber));
      }
      return json(response, 400, { error: 'Unknown Companion layer action.' });
    }

    if (request.method === 'POST' && request.url === '/api/companion-surface-page') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      const surfaceId = String(input.surfaceId || '');
      const pageNumber = Number(input.pageNumber);
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      if (!surfaceId || !Number.isInteger(pageNumber) || pageNumber < 1) return json(response, 400, { error: 'A connected Stream Deck and valid layer are required.' });
      return json(response, 200, await setCompanionSurfacePage(address, surfaceId, pageNumber));
    }

    if (request.method === 'POST' && request.url === '/api/companion-quick-action') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      const pageNumber = Number(input.pageNumber);
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      if (!input.surfaceId || !Number.isInteger(pageNumber) || pageNumber < 1) return json(response, 400, { error: 'Select a connected device and valid page.' });
      const surfaces = await discoverSurfaces(address);
      const surface = surfaces.find((item) => item.id === input.surfaceId && item.connected !== false);
      if (!surface) return json(response, 400, { error: 'The selected Stream Deck is not connected.' });
      if (input.action === 'clear-page') return json(response, 200, await clearSurfacePage(address, surface, pageNumber));
      if (input.action === 'add-layer-scroll') return json(response, 200, await addSurfaceLayerScroll(address, surface, pageNumber));
      if (input.action === 'initialize-encoders') return json(response, 200, await initializeSurfaceEncoders(address, surface, pageNumber));
      return json(response, 400, { error: 'Unknown surface quick action.' });
    }

    if (request.method === 'DELETE' && request.url === '/api/companion-button') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      const pageNumber = Number(input.pageNumber);
      const row = Number(input.row);
      const column = Number(input.column);
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      if (!input.surfaceId || !Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isInteger(row) || row < 0 || !Number.isInteger(column) || column < 0) return json(response, 400, { error: 'Select a valid device button.' });
      const surfaces = await discoverSurfaces(address);
      const surface = surfaces.find((item) => item.id === input.surfaceId && item.connected !== false);
      if (!surface) return json(response, 400, { error: 'The selected Stream Deck is not connected.' });
      if (row < surface.yOffset || row >= surface.yOffset + surface.rows || column < surface.xOffset || column >= surface.xOffset + surface.columns) return json(response, 400, { error: 'The selected button is outside this device.' });
      return json(response, 200, await deleteSurfaceButton(address, surface, pageNumber, row - surface.yOffset + 1, column - surface.xOffset + 1));
    }
    if (request.method === 'POST' && request.url === '/api/companion-button/press') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      const pageNumber = Number(input.pageNumber); const row = Number(input.row); const column = Number(input.column);
      const surfaces = await discoverSurfaces(address);
      const surface = surfaces.find((item) => item.id === input.surfaceId && item.connected !== false);
      if (!surface || !Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isInteger(row) || row < 0 || !Number.isInteger(column) || column < 0) return json(response, 400, { error: 'Select a valid connected-device button.' });
      if (row < surface.yOffset || row >= surface.yOffset + surface.rows || column < surface.xOffset || column >= surface.xOffset + surface.columns) return json(response, 400, { error: 'The selected button is outside this device.' });
      return json(response, 200, await pressSurfaceButton(address, surface, pageNumber, row - surface.yOffset + 1, column - surface.xOffset + 1));
    }

    if (request.method === 'POST' && request.url === '/api/companion-button-transfer') {
      const input = await body(request);
      const address = String(input.address || '127.0.0.1:8000');
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { error: 'Invalid Companion address.' });
      const surfaces = await discoverSurfaces(address);
      const sourceSurface = surfaces.find((item) => item.id === input.sourceSurfaceId && item.connected !== false);
      const targetSurface = surfaces.find((item) => item.id === input.targetSurfaceId && item.connected !== false);
      if (!sourceSurface || !targetSurface) return json(response, 400, { error: 'Both the source and destination Stream Decks must be connected.' });
      const source = input.source || {};
      const target = input.target || {};
      if (![source.page, source.row, source.column, target.page, target.row, target.column].every(Number.isInteger)) return json(response, 400, { error: 'Select a valid source button and empty destination.' });
      const sourceLocal = { ...source, row: source.row - sourceSurface.yOffset + 1, column: source.column - sourceSurface.xOffset + 1 };
      const targetLocal = { ...target, row: target.row - targetSurface.yOffset + 1, column: target.column - targetSurface.xOffset + 1 };
      if (sourceLocal.row < 1 || sourceLocal.row > sourceSurface.rows || sourceLocal.column < 1 || sourceLocal.column > sourceSurface.columns || targetLocal.row < 1 || targetLocal.row > targetSurface.rows || targetLocal.column < 1 || targetLocal.column > targetSurface.columns) return json(response, 400, { error: 'The source or destination is outside its selected device.' });
      return json(response, 200, await transferSurfaceButton(address, { sourceSurface, targetSurface, source: sourceLocal, target: targetLocal, move: input.mode === 'cut' }));
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/companion-buttons')) {
      const url = new URL(request.url, 'http://127.0.0.1');
      const address = url.searchParams.get('address') || '127.0.0.1:8000';
      const page = Number(url.searchParams.get('page') || 1);
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address) || !Number.isInteger(page) || page < 1) return json(response, 400, { error: 'Invalid Companion address or page.' });
      return json(response, 200, { buttons: await discoverPageButtons(address, page) });
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/companion-button-graphics')) {
      const url = new URL(request.url, 'http://127.0.0.1');
      const address = url.searchParams.get('address') || '127.0.0.1:8000';
      const surfaceId = url.searchParams.get('surfaceId') || '';
      const page = Number(url.searchParams.get('page') || 1);
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address) || !Number.isInteger(page) || page < 1) return json(response, 400, { error: 'Invalid Companion address or page.' });
      const surface = (await discoverSurfaces(address)).find((item) => item.id === surfaceId && item.connected !== false);
      if (!surface) return json(response, 400, { error: 'The selected Stream Deck is not connected.' });
      return json(response, 200, { graphics: await discoverSurfaceButtonGraphics(address, surface, page) });
    }

    if (request.method === 'GET' && request.url?.startsWith('/api/companion-status')) {
      const address = new URL(request.url, 'http://127.0.0.1').searchParams.get('address') || '127.0.0.1:8000';
      if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(address)) return json(response, 400, { online: false, error: 'Invalid address' });
      try {
        const reply = await fetch(`http://${address}/`, { signal: AbortSignal.timeout(1800) });
        const html = await reply.text();
        const version = html.match(/v?(\d+\.\d+\.\d+)/)?.[1] || config.companion.version;
        return json(response, 200, { online: reply.ok, version, ccbHostName: hostname(), coordinationPort });
      } catch (error) {
        return json(response, 200, { online: false, error: error.message });
      }
    }

    if (request.method === 'POST' && request.url === '/api/collaboration') {
      const input = await body(request);
      if (!validCustodyAction(input.action)) return json(response, 400, { error: 'Unknown workspace custody action.' });
      const target = coordinatorAddress(input.address || '127.0.0.1:8000', coordinationPort);
      try {
        const upstream = await fetch(`${target}/api/custody`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(1800),
          body: JSON.stringify({ action: input.action, ownerId: input.ownerId, ownerName: input.ownerName, surfaceId: input.surfaceId, surfaceIds: input.surfaceIds, all: input.all }),
        });
        const result = await upstream.json();
        if (upstream.ok && Array.isArray(result.onlineSurfaceIds)) registerSharedSurfacePresence(input.address || '127.0.0.1:8000', result.onlineSurfaceIds);
        return json(response, upstream.ok ? 200 : 400, result);
      } catch (error) {
        return json(response, 503, { available: false, error: `Shared custody coordinator is unavailable at ${target.replace(/^https?:\/\//, '')}. Start CCB on the central Companion computer.` });
      }
    }

    if (request.method === 'GET' && request.url === '/api/status') {
      const ai = aiStatus();
      let online = false;
      if (ai.enabled) {
        try { online = (await fetch(`${ai.endpoint.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(900) })).ok; } catch {}
      }
      return json(response, 200, { parser: 'ready', companion: 'adapter-ready', ai: { ...ai, online }, version: config.companion.version });
    }
    if (request.method === 'GET' && request.url?.startsWith('/api/system-log')) {
      const lines = new URL(request.url, 'http://127.0.0.1').searchParams.get('lines') || 300;
      return json(response, 200, { path: systemLogPath, content: await readSystemLog({ lines }) });
    }
    if (request.method === 'POST' && request.url === '/api/system-log') {
      const input = await body(request);
      await writeSystemLog(input.level || 'error', input.event || 'browser-event', {
        message: String(input.message || '').slice(0, 2000),
        stack: String(input.stack || '').slice(0, 8000),
        context: input.context || {},
      });
      return json(response, 200, { logged: true });
    }
    if (request.method === 'DELETE' && request.url === '/api/system-log') {
      await clearSystemLog();
      await writeSystemLog('info', 'system-log-cleared');
      return json(response, 200, { cleared: true });
    }
    if (request.method === 'POST' && request.url === '/api/system-log/open') {
      await writeSystemLog('info', 'system-log-location-opened');
      await execFileAsync('/usr/bin/open', ['-R', systemLogPath]);
      return json(response, 200, { opened: true, path: systemLogPath });
    }
    if (request.method === 'GET' && request.url === '/api/osc-test-receiver') return json(response, 200, oscReceiverStatus());
    if (request.method === 'POST' && request.url === '/api/osc-test-receiver') {
      const input = await body(request);
      if (input.action === 'start') return json(response, 200, await startOscReceiver(input.port));
      if (input.action === 'stop') return json(response, 200, await stopOscReceiver());
      if (input.action === 'clear') return json(response, 200, clearOscReceiverEvents());
      if (input.action === 'self-test') return json(response, 200, await selfTestOscReceiver(input.port));
      return json(response, 400, { error: 'OSC receiver action must be start, stop, clear, or self-test.' });
    }

    const requested = request.url === '/' ? 'index.html' : request.url.slice(1).split('?')[0];
    const file = normalize(join(root, requested));
    if (!file.startsWith(root)) return json(response, 403, { error: 'Forbidden' });
    const content = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(content);
  } catch (error) {
    await writeSystemLog('error', 'http-request-failed', { method: request.method, path: request.url, message: error.message, stack: error.stack }).catch(() => {});
    if (request.url?.startsWith('/api/')) return json(response, 400, { error: error.message });
    response.writeHead(404);
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Companion Command Builder: http://127.0.0.1:${port}`);
  writeSystemLog('info', 'server-started', { builderVersion: '0.20.60-beta.1+164', companionTarget: config.companion.version, port, platform: process.platform, node: process.version }).catch(() => {});
});
