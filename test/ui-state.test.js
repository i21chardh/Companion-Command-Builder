import test from 'node:test';
import assert from 'node:assert/strict';
import { companionStartupPolicy, createGraphicFrameRegistry, findPlanAtLocation, firstOpenSurfaceLocation, fitsSurfaceGrid, moveRefreshPages, previewDispositionAfterDeploy, quickPreviewChangeAffectsTypography, resolvePlanTargetSurface } from '../public/ui-state.js';

test('cross-page moves refresh the destination and vacated source page', () => {
  assert.deepEqual(moveRefreshPages(1, 2), [2, 1]);
  assert.deepEqual(moveRefreshPages(2, 2), [2]);
  assert.deepEqual(moveRefreshPages(null, 2), [2]);
});

test('blank destination frames reuse the exact verified source graphic without flashing', () => {
  const graphics = createGraphicFrameRegistry();
  assert.equal(graphics.record('band-tb-control', 'band-tb-source-png', { blank: false }), 'band-tb-source-png');
  assert.equal(graphics.record('band-tb-control', 'blank-destination-png', { blank: true }), 'band-tb-source-png');
  assert.deepEqual(graphics.resolve('band-tb-control', 'blank-destination-png'), { knownBlank: true, graphic: 'band-tb-source-png' });
  assert.deepEqual(graphics.resolve('band-tb-control', 'blank-destination-png'), { knownBlank: true, graphic: 'band-tb-source-png' });
});

test('a later valid feedback frame replaces the cached source graphic', () => {
  const graphics = createGraphicFrameRegistry();
  graphics.record('toggle-control', 'unmuted-png', { blank: false });
  assert.equal(graphics.record('toggle-control', 'muted-png', { blank: false }), 'muted-png');
  assert.deepEqual(graphics.resolve('toggle-control', 'muted-png'), { knownBlank: false, graphic: 'muted-png' });
});

test('color-only quick edits preserve the selected button typography', () => {
  assert.equal(quickPreviewChangeAffectsTypography('quick-text-color'), false);
  assert.equal(quickPreviewChangeAffectsTypography('quick-background-color'), false);
  assert.equal(quickPreviewChangeAffectsTypography('quick-button-text'), true);
  assert.equal(quickPreviewChangeAffectsTypography('quick-text-size'), true);
});

test('successful creates and edits clear the button preview after deployment', () => {
  assert.equal(previewDispositionAfterDeploy(['create-button']), 'clear');
  assert.equal(previewDispositionAfterDeploy(['edit-button']), 'clear');
  assert.equal(previewDispositionAfterDeploy(['replace-button']), 'clear');
  assert.equal(previewDispositionAfterDeploy(['edit-button', 'replace-button']), 'clear');
  assert.equal(previewDispositionAfterDeploy(['move-button']), 'retain');
});

test('a global Companion cell targets the surface that owns it instead of the active surface', () => {
  const surfaces = [
    { id: 'deck-right', connected: true, rows: 3, columns: 5, yOffset: 0, xOffset: 4 },
    { id: 'deck-left', connected: true, rows: 4, columns: 4, yOffset: 0, xOffset: 0 },
  ];
  const plans = [{ button: { location: { page: 1, row: 0, column: 3 } } }];
  assert.equal(resolvePlanTargetSurface(surfaces, plans, 'deck-right')?.id, 'deck-left');
  assert.equal(resolvePlanTargetSurface(surfaces, [{ button: { location: { page: 1, row: 1, column: 7 } } }], 'deck-left')?.id, 'deck-right');
});

test('offline templates use the same zero-based cell IDs as Companion', () => {
  const mk2 = { rows: 3, columns: 5, xOffset: 0, yOffset: 0, offline: true };
  assert.equal(fitsSurfaceGrid(mk2, { page: 1, row: 0, column: 0 }, { local: true }), true);
  assert.equal(fitsSurfaceGrid(mk2, { page: 1, row: 2, column: 4 }, { local: true }), true);
  assert.equal(fitsSurfaceGrid(mk2, { page: 1, row: 3, column: 4 }, { local: true }), false);
  assert.equal(fitsSurfaceGrid(mk2, { page: 1, row: 2, column: 5 }, { local: true }), false);
});

test('an offline workspace selection resolves the committed button for editor hydration', () => {
  const plan = {
    kind: 'create-button',
    button: {
      location: { page: 1, row: 2, column: 3 }, text: 'MIDI CC 12\nMOMENTARY',
      appearance: { textColor: '#ffffff', backgroundColor: '#172b4d' },
      action: { family: 'midi', operation: 'momentary-cc' },
    },
    actions: [{ step: 1, actionId: 'cc', summary: 'Press CC 12' }, { step: 2, actionId: 'cc', summary: 'Release CC 14' }],
  };
  const selected = findPlanAtLocation([plan], { page: 1, row: 2, column: 3 });
  assert.equal(selected, plan);
  assert.equal(selected.button.text, 'MIDI CC 12\nMOMENTARY');
  assert.equal(selected.button.appearance.backgroundColor, '#172b4d');
  assert.deepEqual(selected.actions.map((action) => action.summary), ['Press CC 12', 'Release CC 14']);
  assert.equal(findPlanAtLocation([plan], { page: 1, row: 2, column: 2 }), null);
});

test('location-free commands choose the first empty cell on the selected surface and layer', () => {
  const surface = { rows: 2, columns: 3, xOffset: 4, yOffset: 1 };
  const occupied = [
    { page: 2, row: 1, column: 4 },
    { button: { location: { page: 2, row: 1, column: 5 } } },
  ];
  assert.deepEqual(firstOpenSurfaceLocation(surface, 2, occupied), { page: 2, row: 1, column: 6 });
  const full = [];
  for (let row = 1; row < 3; row += 1) for (let column = 4; column < 7; column += 1) full.push({ page: 2, row, column });
  assert.equal(firstOpenSurfaceLocation(surface, 2, full), null);
});

test('Satellite startup remains offline and requires one-at-a-time enrollment', () => {
  const policy = companionStartupPolicy([{ id: 'satellite-deck', connected: true, satellite: true }]);
  assert.deepEqual(policy, {
    satelliteNetworkMode: true,
    satelliteStartupOffline: true,
    autoPromptStartupSync: false,
    enrollOnlineSurfacesAutomatically: false,
  });
});

test('direct Companion surfaces hydrate and prompt automatically', () => {
  const policy = companionStartupPolicy([{ id: 'local-deck', connected: true, satellite: false }]);
  assert.deepEqual(policy, {
    satelliteNetworkMode: false,
    satelliteStartupOffline: false,
    autoPromptStartupSync: true,
    enrollOnlineSurfacesAutomatically: true,
  });
});

test('reconnect and explicit Satellite selection do not reset an active workspace', () => {
  assert.equal(companionStartupPolicy([{ connected: true, satellite: true }], { previouslyHadOnlineSurface: true }).satelliteStartupOffline, false);
  assert.equal(companionStartupPolicy([{ connected: true, satellite: true }], { selectedDuringSwitch: true }).satelliteStartupOffline, false);
});
