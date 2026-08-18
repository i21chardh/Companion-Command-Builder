#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { parseCommand } from '../src/parser.js';
import { buildDeploymentPlan } from '../src/plan.js';
import { defaultConfig } from '../src/config.js';
import { parseEditCommand } from '../src/edit.js';
import { splitBatchCommands, duplicateLocations, expandLayoutCommand } from '../src/batch.js';
import { auditGeneratorBatches } from './audit-generator-batches.js';
import { companionSafeFontPercent } from '../public/appearance.js';
import { companionStartupPolicy, createGraphicFrameRegistry, firstOpenSurfaceLocation, moveRefreshPages, previewDispositionAfterDeploy, quickPreviewChangeAffectsTypography, resolvePlanTargetSurface, toggleWorkspaceSurfaceSelection } from '../public/ui-state.js';
import { ccbGlobalLocation, companionLocation, moveReadbackStatus, planNonOverlappingSurfaceOffsets } from '../src/companion.js';
import { APPEARANCE_CASES, EDIT_PROMPTS, LIVE_WORKFLOWS, STRESS_PROMPTS } from '../src/stress-audit-corpus.js';
import { deserializePresetDocument, serializePresetDocument } from '../src/preset-store.js';
import { provisionalAdapter } from '../src/adapters/provisional.js';
import { interpretKnownDynamicCommand } from '../src/deterministic-dynamic.js';
import { buildDynamicPlan, validateDynamicPlanAvailability } from '../src/adapters/dynamic.js';
import { interactiveAiTimeoutMs } from '../src/ai.js';
import { resolveBatchModule } from '../src/module-routing.js';

function normalizedModule(value) { return String(value || '').replace(/_/g, '-'); }
function locationTuple(location) { return [location.page, location.row, location.column]; }
function same(actual, expected) { return JSON.stringify(actual) === JSON.stringify(expected); }

function result(test, actual, mismatches = []) {
  return { id: test.id, category: test.category || 'edit', severity: test.severity, status: mismatches.length ? 'fail' : 'pass', prompt: test.prompt, expected: test.expect, actual, mismatches };
}

function auditPrompt(test) {
  try {
    const parsed = parseCommand(test.prompt, { targetModuleId: test.moduleId });
    const plan = buildDeploymentPlan(parsed, defaultConfig);
    const actual = {
      moduleId: normalizedModule(plan.module?.id), location: locationTuple(plan.button.location), operation: plan.button.action.operation,
      channels: plan.button.action.channels, textColor: plan.button.appearance.textColor, backgroundColor: plan.button.appearance.backgroundColor,
      states: Boolean(plan.button.appearance.states), pressController: plan.button.action.press?.controller, pressValue: plan.button.action.press?.value,
      releaseController: plan.button.action.release?.controller, releaseValue: plan.button.action.release?.value,
    };
    const mismatches = [];
    if (normalizedModule(test.moduleId) !== actual.moduleId) mismatches.push(`module ${actual.moduleId}`);
    for (const [key, expected] of Object.entries(test.expect)) if (!same(actual[key], expected)) mismatches.push(`${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual[key])}`);
    return result(test, actual, mismatches);
  } catch (error) { return result(test, { error: error.message }, [error.message]); }
}

function auditEdit(test) {
  try {
    const parsed = parseEditCommand(test.prompt);
    const actual = { location: locationTuple(parsed.location), ...parsed.changes, visualToggle: Boolean(parsed.changes.invertColors || parsed.changes.visualToggle) };
    const mismatches = [];
    for (const [key, expected] of Object.entries(test.expect)) if (!same(actual[key], expected)) mismatches.push(`${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual[key])}`);
    return result({ ...test, category: 'edit' }, actual, mismatches);
  } catch (error) { return result({ ...test, category: 'edit' }, { error: error.message }, [error.message]); }
}

function auditAppearance(test) {
  const actual = companionSafeFontPercent(test.text, test.requested);
  return result({ ...test, category: 'appearance', severity: 'critical', prompt: `${test.text} @ ${test.requested}` }, { companionPercent: actual }, actual === test.expectedPercent ? [] : [`expected ${test.expectedPercent}, got ${actual}`]);
}

function auditUiState() {
  const graphics = createGraphicFrameRegistry();
  const source = graphics.record('audit-control', 'verified-source-frame', { blank: false });
  const firstBlank = graphics.record('audit-control', 'blank-target-frame', { blank: true });
  const repeatedBlank = graphics.resolve('audit-control', 'blank-target-frame');
  const from = { pageNumber: 1, row: 1, column: 1 };
  const to = { pageNumber: 2, row: 2, column: 9 };
  const pageState = (source, destination) => ({ type: 'init', order: ['p1', 'p2'], pages: {
    p1: { controls: { 1: source ? { 1: source } : {} } },
    p2: { controls: { 2: destination ? { 9: destination } : {} } },
  } });
  const cases = [
    ['move-refresh-cross-page', moveRefreshPages(1, 2), [2, 1]],
    ['move-refresh-same-page', moveRefreshPages(2, 2), [2]],
    ['graphic-verified-source', source, 'verified-source-frame'],
    ['graphic-first-blank-fallback', firstBlank, 'verified-source-frame'],
    ['graphic-repeated-blank-no-flash', repeatedBlank, { knownBlank: true, graphic: 'verified-source-frame' }],
    ['move-readback-native-success', moveReadbackStatus(pageState(null, 'audit-control'), from, to, 'audit-control').status, 'moved'],
    ['move-readback-fallback-required', moveReadbackStatus(pageState('audit-control', null), from, to, 'audit-control').status, 'unchanged'],
    ['move-readback-never-delete-missing', moveReadbackStatus(pageState(null, null), from, to, 'audit-control').status, 'missing'],
    ['ccb-zero-cell-matches-companion-grid', companionLocation({ page: 1, row: 0, column: 0 }), { pageNumber: 1, row: 0, column: 0 }],
    ['companion-zero-cell-matches-ccb-grid', ccbGlobalLocation({ pageNumber: 1, row: 0, column: 0 }), { page: 1, row: 0, column: 0 }],
    ['ccb-rightmost-matches-companion-grid', companionLocation({ page: 2, row: 2, column: 8 }), { pageNumber: 2, row: 2, column: 8 }],
    ['companion-rightmost-matches-ccb-grid', ccbGlobalLocation({ pageNumber: 2, row: 2, column: 8 }), { page: 2, row: 2, column: 8 }],
    ['satellite-starts-offline', companionStartupPolicy([{ connected: true, satellite: true }]).satelliteStartupOffline, true],
    ['satellite-does-not-auto-prompt', companionStartupPolicy([{ connected: true, satellite: true }]).autoPromptStartupSync, false],
    ['satellite-does-not-auto-enroll', companionStartupPolicy([{ connected: true, satellite: true }]).enrollOnlineSurfacesAutomatically, false],
    ['direct-companion-does-not-start-offline', companionStartupPolicy([{ connected: true, satellite: false }]).satelliteStartupOffline, false],
    ['direct-companion-auto-prompts', companionStartupPolicy([{ connected: true, satellite: false }]).autoPromptStartupSync, true],
    ['direct-companion-auto-enrolls', companionStartupPolicy([{ connected: true, satellite: false }]).enrollOnlineSurfacesAutomatically, true],
    ['font-color-preserves-typography', quickPreviewChangeAffectsTypography('quick-text-color'), false],
    ['background-color-preserves-typography', quickPreviewChangeAffectsTypography('quick-background-color'), false],
    ['button-text-reflows-typography', quickPreviewChangeAffectsTypography('quick-button-text'), true],
    ['text-size-reflows-typography', quickPreviewChangeAffectsTypography('quick-text-size'), true],
    ['deployed-create-clears-button-preview', previewDispositionAfterDeploy('create-button'), 'clear'],
    ['deployed-edit-clears-button-preview', previewDispositionAfterDeploy('edit-button'), 'clear'],
    ['deployed-replacement-clears-button-preview', previewDispositionAfterDeploy('replace-button'), 'clear'],
    ['deployed-move-retains-button-preview', previewDispositionAfterDeploy('move-button'), 'retain'],
    ['offline-5x3-can-be-fully-deselected', toggleWorkspaceSurfaceSelection(['offline:mk2'], 'offline:mk2', false, 'offline:mk2'), { selectedIds: [], nextActiveId: '' }],
    ['global-cell-auto-targets-owning-surface', resolvePlanTargetSurface([
      { id: 'deck-right', connected: true, rows: 3, columns: 5, yOffset: 0, xOffset: 4 },
      { id: 'deck-left', connected: true, rows: 4, columns: 4, yOffset: 0, xOffset: 0 },
    ], [{ button: { location: { page: 1, row: 0, column: 3 } } }], 'deck-right')?.id, 'deck-left'],
    ['overlapping-decks-auto-pack-side-by-side', planNonOverlappingSurfaceOffsets([
      { id: 'deck-a', xOffset: 0, yOffset: 0, columns: 5, rows: 3 },
      { id: 'deck-plus', xOffset: 0, yOffset: 0, columns: 4, rows: 4 },
    ]).placements, [{ id: 'deck-plus', xOffset: 0, yOffset: 0 }, { id: 'deck-a', xOffset: 4, yOffset: 0 }]],
    ['studio-and-xl-expand-to-26x4-grid', planNonOverlappingSurfaceOffsets([
      { id: 'studio', xOffset: 0, yOffset: 0, columns: 18, rows: 2 },
      { id: 'xl', xOffset: 0, yOffset: 0, columns: 8, rows: 4 },
    ]).requiredGrid, { minColumn: 0, minRow: 0, maxColumn: 25, maxRow: 3, columns: 26, rows: 4 }],
  ];
  return cases.map(([id, actual, expected]) => ({
    id, category: 'ui-state', severity: 'critical', status: same(actual, expected) ? 'pass' : 'fail', actual, expected,
    ...(same(actual, expected) ? {} : { mismatches: [`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`] }),
  }));
}

function auditSourceContracts() {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const cases = [
    ['no-hidden-grid-migration-ui', !/companion-grid-origin|planFullGridMigration|planOneBasedGridMigration/.test(app), true],
    ['no-hidden-grid-migration-endpoint', !/companion-grid-origin/.test(server), true],
    ['quick-editor-color-inputs-use-typography-policy', /paintQuickPreview\(\{ preserveTypography: !quickPreviewChangeAffectsTypography\(control\.id\) \}\)/.test(app), true],
    ['quick-editor-color-inputs-recolor-exact-frame', /paintExactQuickColorPreview\(\)/.test(app) && /recolorCompanionFrame\(frame\.data/.test(app), true],
    ['redundant-editing-mode-row-absent', !/EDITING MODE|id="transfer-mode"|class="transfer-bar/.test(html) && !/#transfer-mode/.test(app), true],
    ['momentary-midi-release-uses-up-action-set', /definition, 'up'\)/.test(readFileSync(new URL('../src/companion.js', import.meta.url), 'utf8')), true],
    ['offline-workspace-button-click-opens-editor', /selectedPlan = findPlanAtLocation\(surfacePlans\(\), \{ page, row, column \}\)/.test(app) && /selectGridItem\(\{ type: 'planned', page, row, column \}\)/.test(app), true],
    ['native-save-picker-wired', /window\.showSaveFilePicker/.test(app) && /presetBrowserFileHandle\.createWritable\(\)/.test(app), true],
    ['native-load-picker-wired', /window\.showOpenFilePicker/.test(app) && /presetFileInput\.click\(\)/.test(app), true],
    ['interactive-ai-timeout-bounded', interactiveAiTimeoutMs() <= 6000, true],
    ['satellite-install-uses-startup-policy', /companionStartupPolicy\(online, \{ previouslyHadOnlineSurface, selectedDuringSwitch: Boolean\(selectedDuringSwitch\) \}\)/.test(app), true],
    ['satellite-sync-prompt-uses-startup-policy', /companionStartupPolicy\(attached\)\.autoPromptStartupSync/.test(app), true],
    ['mixed-online-offline-picker-always-available', /const available = \[\.\.\.onlineSurfaces, \.\.\.offlineSurfaces\]/.test(app) && !/<label for="surface-model">Offline template<\/label>/.test(html), true],
    ['surface-refresh-does-not-restore-empty-workspace', !/if \(!workspaceSurfaceIds\.size\) workspaceSurfaceIds\.add\(target\?\.id \|\| modelSelect\.value\)/.test(app), true],
    ['online-refresh-respects-empty-workspace', /const target = !workspaceSurfaceIds\.size \? null : satelliteStartupOffline \? null/.test(app), true],
  ];
  return cases.map(([id, actual, expected]) => ({
    id, category: 'source-contract', severity: 'critical', status: actual === expected ? 'pass' : 'fail', actual, expected,
    ...(actual === expected ? {} : { mismatches: [`expected ${expected}, got ${actual}`] }),
  }));
}

function auditPresetPersistence() {
  const button = (column, text) => ({ kind: 'create-button', button: { location: { page: 1, row: 1, column }, text, appearance: { textColor: '#ffffff', backgroundColor: '#000000' }, action: { family: 'audit', operation: text.toLowerCase() } } });
  const preset = { format: 'companion-command-builder-layout', schemaVersion: 1, model: 'offline:mk2', pages: [{ page: 1, name: 'Layer 1', plans: [button(1, 'PLAY'), button(2, 'STOP'), button(3, 'RECORD')] }], workspaceSurfaces: [] };
  let actual;
  try { actual = deserializePresetDocument(serializePresetDocument(preset)); }
  catch (error) { actual = { error: error.message }; }
  return [{ id: 'preset-three-button-roundtrip', category: 'persistence', severity: 'critical', status: same(actual, preset) ? 'pass' : 'fail', actual, expected: preset, ...(same(actual, preset) ? {} : { mismatches: ['saved preset did not reload exactly'] }) }];
}

function auditReaperTransportExpansion() {
  const prompt = 'create 3 buttons at 1.0.0-1.0.3 for reaper transport controls';
  const expected = [
    'Create a REAPER play button labeled "PLAY" at 1/0/0',
    'Create a REAPER stop button labeled "STOP" at 1/0/1',
    'Create a REAPER record button labeled "RECORD" at 1/0/2',
  ];
  const commands = expandLayoutCommand(prompt, 'cockos-reaper');
  let actual;
  try {
    const adapter = provisionalAdapter('cockos-reaper');
    const plans = commands.map((command) => buildDynamicPlan(adapter, interpretKnownDynamicCommand(command, adapter), { product: 'Bitfocus Companion' }));
    actual = { commands, actions: plans.map((plan) => plan.button.action.operation), locations: plans.map((plan) => locationTuple(plan.button.location)) };
  } catch (error) { actual = { commands, error: error.message }; }
  const expectedResult = { commands: expected, actions: ['play', 'stop', 'record'], locations: [[1, 0, 0], [1, 0, 1], [1, 0, 2]] };
  return [{ id: 'reaper-native-zero-compact-range', category: 'multi-module-batch', severity: 'critical', status: same(actual, expectedResult) ? 'pass' : 'fail', prompt, actual, expected: expectedResult, ...(same(actual, expectedResult) ? {} : { mismatches: ['REAPER transport range did not build three deployable native-coordinate buttons'] }) }];
}

function auditReaperTransportAnchor() {
  const prompt = 'create reaper transport controls at 1.1.4"';
  const commands = expandLayoutCommand(prompt, 'cockos-reaper');
  let actual;
  try {
    const adapter = provisionalAdapter('cockos-reaper');
    const plans = commands.map((command) => buildDynamicPlan(adapter, interpretKnownDynamicCommand(command, adapter), { product: 'Bitfocus Companion' }));
    actual = { actions: plans.map((plan) => plan.button.action.operation), locations: plans.map((plan) => locationTuple(plan.button.location)) };
  } catch (error) { actual = { error: error.message }; }
  const expected = { actions: ['play', 'stop', 'record'], locations: [[1, 1, 4], [1, 1, 5], [1, 1, 6]] };
  return [{ id: 'reaper-transport-anchor-expands-right', category: 'multi-module-batch', severity: 'critical', status: same(actual, expected) ? 'pass' : 'fail', prompt, actual, expected, ...(same(actual, expected) ? {} : { mismatches: ['REAPER transport anchor did not create Play, Stop, and Record in adjacent cells'] }) }];
}

function auditAxientRfPower() {
  const prompt = 'add a button at 1.0.3 for axient slot 1 rf power';
  let actual;
  try {
    const moduleId = resolveBatchModule(prompt, 'digico-osc');
    const adapter = provisionalAdapter(moduleId);
    const interpretation = interpretKnownDynamicCommand(prompt, adapter);
    const plan = buildDynamicPlan(adapter, interpretation, { product: 'Bitfocus Companion' });
    actual = {
      moduleId,
      actionId: plan.button.action.operation,
      options: plan.button.action.definitions[0].options,
      location: locationTuple(plan.button.location),
    };
  } catch (error) { actual = { error: error.message }; }
  const expected = { moduleId: 'shure-wireless', actionId: 'slot_rf_power', options: { slot: '1:1', power: 'NORMAL' }, location: [1, 0, 3] };
  return [{ id: 'axient-slot-rf-power-routes-away-from-digico', category: 'module-routing', severity: 'critical', status: same(actual, expected) ? 'pass' : 'fail', prompt, actual, expected, ...(same(actual, expected) ? {} : { mismatches: ['Axient RF power did not produce a deployable Shure Wireless action'] }) }];
}

function auditConditionalModuleSchema() {
  const plan = { module: { id: 'shure-wireless', version: '2.3.1' }, button: { action: { family: 'dynamic', definitions: [{ definitionId: 'slot_rf_power', options: { slot: '1:1', power: 'NORMAL' } }] } } };
  let blocked = false;
  let message = '';
  try { validateDynamicPlanAvailability(plan, { actions: { channel_mute: {} } }, { label: 'shure-wx' }); }
  catch (error) { blocked = true; message = error.message; }
  const actual = { blocked, axientGuidance: /AD4D or AD4Q/.test(message), availableWhenExposed: validateDynamicPlanAvailability(plan, { actions: { slot_rf_power: {} } }, { label: 'shure-wx' }) };
  const expected = { blocked: true, axientGuidance: true, availableWhenExposed: true };
  return [{ id: 'conditional-shure-model-schema-gate', category: 'module-routing', severity: 'critical', status: same(actual, expected) ? 'pass' : 'fail', actual, expected, ...(same(actual, expected) ? {} : { mismatches: ['Conditional Shure model action was not validated against the live schema'] }) }];
}

function auditShureReadoutBatch() {
  const prompt = 'create 2 buttons at 1.1.1 and 1.2.1 that show selected channel gain and frequency for shure';
  let actual;
  try {
    const adapter = provisionalAdapter('shure-wireless');
    const plans = expandLayoutCommand(prompt, 'shure-wireless').map((command) => buildDynamicPlan(adapter, interpretKnownDynamicCommand(command, adapter), { product: 'Bitfocus Companion' }));
    actual = {
      locations: plans.map((plan) => locationTuple(plan.button.location)),
      operations: plans.map((plan) => plan.button.action.operation),
      variables: plans.map((plan) => plan.button.action.variableId),
      pressActions: plans.map((plan) => plan.button.action.family === 'dynamic'),
    };
  } catch (error) { actual = { error: error.message }; }
  const expected = { locations: [[1, 1, 1], [1, 2, 1]], operations: ['show-gain', 'show-frequency'], variables: ['ch_1_audio_gain', 'ch_1_frequency'], pressActions: [false, false] };
  return [{ id: 'shure-two-button-live-readout', category: 'multi-module-batch', severity: 'critical', status: same(actual, expected) ? 'pass' : 'fail', prompt, actual, expected, ...(same(actual, expected) ? {} : { mismatches: ['Shure gain/frequency readouts did not build as two live-variable buttons'] }) }];
}

function auditFirstOpenPlacement() {
  const surface = { rows: 2, columns: 2, xOffset: 3, yOffset: 1 };
  const actual = firstOpenSurfaceLocation(surface, 4, [{ page: 4, row: 1, column: 3 }]);
  const expected = { page: 4, row: 1, column: 4 };
  return [{ id: 'missing-location-uses-selected-grid-first-open-cell', category: 'ui-state', severity: 'critical', status: same(actual, expected) ? 'pass' : 'fail', actual, expected, ...(same(actual, expected) ? {} : { mismatches: ['Automatic placement did not honor selected surface offsets and layer'] }) }];
}

export function runStressAudit() {
  const results = [
    ...STRESS_PROMPTS.map(auditPrompt),
    ...EDIT_PROMPTS.map(auditEdit),
    ...APPEARANCE_CASES.map(auditAppearance),
    ...auditUiState(),
    ...auditSourceContracts(),
    ...auditPresetPersistence(),
    ...auditReaperTransportExpansion(),
    ...auditReaperTransportAnchor(),
    ...auditAxientRfPower(),
    ...auditConditionalModuleSchema(),
    ...auditShureReadoutBatch(),
    ...auditFirstOpenPlacement(),
  ];
  try {
    for (const batch of auditGeneratorBatches()) results.push({ ...batch, category: 'multi-module-batch', severity: 'critical', status: 'pass' });
  } catch (error) { results.push({ id: 'generator-batches', category: 'multi-module-batch', severity: 'critical', status: 'fail', mismatches: [error.message] }); }
  const duplicateProbe = splitBatchCommands('Create mute channel 1 at 1/1/1; Create mute channel 2 at 1/1/1').map((prompt) => buildDeploymentPlan(parseCommand(prompt, { targetModuleId: 'digico-osc' }), defaultConfig));
  results.push({ id: 'duplicate-location-guard', category: 'batch', severity: 'critical', status: same(duplicateLocations(duplicateProbe), ['1/1/1']) ? 'pass' : 'fail', actual: duplicateLocations(duplicateProbe), expected: ['1/1/1'] });
  const totals = { cases: results.length, passed: results.filter((item) => item.status === 'pass').length, failed: results.filter((item) => item.status === 'fail').length, livePending: LIVE_WORKFLOWS.length };
  const byCategory = Object.fromEntries([...new Set(results.map((item) => item.category))].sort().map((category) => {
    const items = results.filter((item) => item.category === category);
    return [category, { total: items.length, passed: items.filter((item) => item.status === 'pass').length, failed: items.filter((item) => item.status === 'fail').length }];
  }));
  return { generatedAt: new Date().toISOString(), gate: totals.failed ? 'FAIL' : 'PASS-OFFLINE-LIVE-PENDING', totals, byCategory, results, liveWorkflows: LIVE_WORKFLOWS.map((item) => ({ ...item, status: 'pending-live-validation' })) };
}

export function markdownReport(report) {
  const failures = report.results.filter((item) => item.status === 'fail');
  return `# CCB stress audit\n\nGate: **${report.gate}**  \nGenerated: ${report.generatedAt}\n\n## Totals\n\n- Offline checks: ${report.totals.cases}\n- Passed: ${report.totals.passed}\n- Failed: ${report.totals.failed}\n- Live workflows pending: ${report.totals.livePending}\n\n## Failures\n\n${failures.length ? failures.map((item) => `- **${item.id}** (${item.category}/${item.severity}): ${(item.mismatches || []).join('; ')}`).join('\n') : '- None'}\n\n## Live validation queue\n\n${report.liveWorkflows.map((item) => `- [ ] **${item.id}** (${item.category}/${item.severity}) — ${item.steps}`).join('\n')}\n`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const report = runStressAudit();
  await Promise.all([
    writeFile(new URL('./stress-audit-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(new URL('./stress-audit-report.md', import.meta.url), markdownReport(report)),
  ]);
  console.log(JSON.stringify({ gate: report.gate, totals: report.totals, byCategory: report.byCategory }, null, 2));
  process.exitCode = report.totals.failed ? 1 : 0;
}
