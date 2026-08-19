import test from 'node:test';
import assert from 'node:assert/strict';
import { actionDefinitions, actionManifest, applyDefinitionEvent, ccbGlobalLocation, ccbLocation, ccbSurface, companionLocation, discoverLocalSurfaces, expandCompanionGrid, extractControlActions, fitButtonText, graphicsFrameSettled, moveReadbackStatus, normalizeSurface, planFullGridMigration, planNonOverlappingSurfaceOffsets, planOneBasedGridMigration, reconcileSatelliteSurfaces, satelliteSurfaceBaseId, summarizeControlActions, surfaceCompatibility, surfaceGridOverflow, surfaceLocation, surfaceRotaryLocations, surfacesOverlap, toggleStateFeedbackDefinition } from '../src/companion.js';

test('collects initial and delayed Companion definition updates for one connection', () => {
  let definitions = applyDefinitionEvent(null, { type: 'init', definitions: { obs1: {} } }, 'obs1');
  definitions = applyDefinitionEvent(definitions, { type: 'update', connectionId: 'obs1', definitions: { startRecording: { name: 'Start Recording', options: [] } } }, 'obs1');
  definitions = applyDefinitionEvent(definitions, { type: 'set', instanceId: 'obs1', actionId: 'stopRecording', definition: { name: 'Stop Recording', options: [] } }, 'obs1');
  definitions = applyDefinitionEvent(definitions, { type: 'update', connectionId: 'another', definitions: { ignored: { name: 'Ignored' } } }, 'obs1');
  assert.deepEqual(Object.keys(definitions).sort(), ['startRecording', 'stopRecording']);
});

test('keeps Companion-native coordinates unchanged', () => {
  assert.deepEqual(companionLocation({ page: 2, row: 0, column: 3 }), { pageNumber: 2, row: 0, column: 3 });
  assert.deepEqual(ccbGlobalLocation({ pageNumber: 2, row: 0, column: 3 }), { page: 2, row: 0, column: 3 });
});

test('presents raw Companion surface offsets without translation', () => {
  assert.deepEqual(ccbSurface({ id: 'deck', xOffset: 4, yOffset: 0 }), { id: 'deck', xOffset: 4, yOffset: 0, companionXOffset: 4, companionYOffset: 0 });
});

test('compacts two independent surfaces into the full 9 by 4 Companion grid', () => {
  const surfaces = [
    { id: 'plus', xOffset: 1, yOffset: 1, columns: 4, rows: 4 },
    { id: 'deck', xOffset: 5, yOffset: 1, columns: 5, rows: 3 },
  ];
  assert.equal(surfaceGridOverflow(surfaces), true);
  const migration = planFullGridMigration(surfaces, [
    { controlId: 'band', pageNumber: 1, row: 1, column: 1 },
    { controlId: 'snap5', pageNumber: 2, row: 3, column: 9 },
  ]);
  assert.deepEqual(migration.delta, { x: -1, y: -1 });
  assert.deepEqual(migration.moves.find((move) => move.controlId === 'snap5').to, { pageNumber: 2, row: 2, column: 8 });
  assert.equal(migration.collisions.length, 0);
  assert.equal(surfaceGridOverflow(surfaces.map((surface) => ({ ...surface, xOffset: surface.xOffset - 1, yOffset: surface.yOffset - 1 }))), false);
});

test('automatically places overlapping 5x3 and 4x4 decks into separate grid regions', () => {
  const surfaces = [
    { id: 'deck-a', xOffset: 0, yOffset: 0, columns: 5, rows: 3 },
    { id: 'deck-plus', xOffset: 0, yOffset: 0, columns: 4, rows: 4 },
  ];
  assert.equal(surfacesOverlap(surfaces), true);
  const plan = planNonOverlappingSurfaceOffsets(surfaces);
  assert.equal(plan.changed, true);
  assert.deepEqual(plan.placements, [
    { id: 'deck-plus', xOffset: 0, yOffset: 0 },
    { id: 'deck-a', xOffset: 4, yOffset: 0 },
  ]);
  assert.deepEqual(plan.requiredGrid, { minColumn: 0, minRow: 0, maxColumn: 8, maxRow: 3, columns: 9, rows: 4 });
  assert.equal(surfacesOverlap(surfaces.map((surface) => ({ ...surface, ...plan.placements.find((item) => item.id === surface.id) }))), false);
});

test('preserves explicit non-overlapping surface offsets', () => {
  const surfaces = [
    { id: 'deck-plus', xOffset: 0, yOffset: 0, columns: 4, rows: 4 },
    { id: 'deck-a', xOffset: 4, yOffset: 0, columns: 5, rows: 3 },
  ];
  assert.deepEqual(planNonOverlappingSurfaceOffsets(surfaces), {
    changed: false,
    placements: [{ id: 'deck-plus', xOffset: 0, yOffset: 0 }, { id: 'deck-a', xOffset: 4, yOffset: 0 }],
    requiredGrid: { minColumn: 0, minRow: 0, maxColumn: 8, maxRow: 3, columns: 9, rows: 4 },
  });
});

test('expands automatic placement for a Stream Deck Studio and XL', () => {
  const plan = planNonOverlappingSurfaceOffsets([
    { id: 'studio', xOffset: 0, yOffset: 0, columns: 18, rows: 2 },
    { id: 'xl', xOffset: 0, yOffset: 0, columns: 8, rows: 4 },
  ]);
  assert.deepEqual(plan.placements, [
    { id: 'xl', xOffset: 0, yOffset: 0 },
    { id: 'studio', xOffset: 8, yOffset: 0 },
  ]);
  assert.deepEqual(plan.requiredGrid, { minColumn: 0, minRow: 0, maxColumn: 25, maxRow: 3, columns: 26, rows: 4 });
  assert.deepEqual(expandCompanionGrid({ minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 }, plan.requiredGrid), {
    minColumn: 0, maxColumn: 25, minRow: 0, maxRow: 3,
  });
});

test('automatic surface placement never shrinks an existing Companion grid', () => {
  assert.deepEqual(expandCompanionGrid(
    { minColumn: -2, maxColumn: 30, minRow: -1, maxRow: 8 },
    { minColumn: 0, maxColumn: 25, minRow: 0, maxRow: 3, columns: 26, rows: 4 },
  ), { minColumn: -2, maxColumn: 30, minRow: -1, maxRow: 8 });
});

test('keeps the rightmost CCB cell identical to the Companion grid cell', () => {
  assert.deepEqual(companionLocation({ page: 2, row: 2, column: 8 }), { pageNumber: 2, row: 2, column: 8 });
});

test('maps surface-local positions onto Companion native offsets', () => {
  const surface = { xOffset: 4, yOffset: 2 };
  const companion = surfaceLocation(surface, { page: 1, row: 1, column: 1 });
  assert.deepEqual(companion, { pageNumber: 1, row: 2, column: 4 });
  assert.deepEqual(ccbLocation(surface, companion), { page: 1, row: 1, column: 1 });
});

test('plans a one-based migration from the actual sizes and offsets of multiple surfaces', () => {
  const surfaces = [
    { id: 'deck-a', xOffset: 0, yOffset: 0, columns: 4, rows: 4 },
    { id: 'deck-b', xOffset: 4, yOffset: 0, columns: 5, rows: 3 },
  ];
  const controls = [
    { controlId: 'a', pageNumber: 1, row: 0, column: 0 },
    { controlId: 'b', pageNumber: 1, row: 2, column: 6 },
    { controlId: 'outside', pageNumber: 1, row: 10, column: 10 },
  ];
  const migration = planOneBasedGridMigration(surfaces, controls);
  assert.deepEqual(migration.delta, { x: 1, y: 1 });
  assert.deepEqual(migration.moves.map((move) => [move.controlId, move.to.row, move.to.column]).sort(), [['a', 1, 1], ['b', 3, 7]]);
  assert.equal(migration.collisions.length, 0);
});

test('shifts only the zero-based axis and rejects an external destination collision', () => {
  const surfaces = [{ id: 'deck', xOffset: 3, yOffset: 0, columns: 2, rows: 2 }];
  const controls = [
    { controlId: 'source', pageNumber: 1, row: 0, column: 3 },
    { controlId: 'blocker', pageNumber: 1, row: 1, column: 3 },
  ];
  const migration = planOneBasedGridMigration(surfaces, controls);
  assert.deepEqual(migration.delta, { x: 0, y: 1 });
  assert.equal(migration.collisions.length, 0, 'the blocker is also inside the migrating surface and moves first');
  const blocked = planOneBasedGridMigration(surfaces, [...controls, { controlId: 'external', pageNumber: 1, row: 2, column: 3 }]);
  assert.equal(blocked.collisions.length, 1);
});

test('keeps graphic-prefixed button labels on whole-word lines', () => {
  assert.equal(fitButtonText('▶STOP'), '▶\nSTOP');
  assert.equal(fitButtonText('▶ RECORD'), '▶\nRECORD');
  assert.equal(fitButtonText('STOP'), 'STOP');
});

test('waits for Companion graphics to settle instead of accepting an initial black frame', () => {
  assert.equal(graphicsFrameSettled({ ready: true, lastUpdatedAt: 900, now: 1000, settleMs: 180 }), false);
  assert.equal(graphicsFrameSettled({ ready: true, lastUpdatedAt: 800, now: 1000, settleMs: 180 }), true);
  assert.equal(graphicsFrameSettled({ ready: false, lastUpdatedAt: 700, now: 1000, settleMs: 180 }), false);
  assert.equal(graphicsFrameSettled({ ready: true, lastUpdatedAt: 0, now: 1000, settleMs: 180 }), false);
});

test('classifies native move read-back before allowing source deletion', () => {
  const from = { pageNumber: 1, row: 1, column: 1 };
  const to = { pageNumber: 2, row: 2, column: 9 };
  const pageState = (source, destination) => ({ type: 'init', order: ['p1', 'p2'], pages: {
    p1: { controls: { 1: source ? { 1: source } : {} } },
    p2: { controls: { 2: destination ? { 9: destination } : {} } },
  } });
  assert.equal(moveReadbackStatus(pageState('snap5', null), from, to, 'snap5').status, 'unchanged');
  assert.equal(moveReadbackStatus(pageState(null, 'snap5'), from, to, 'snap5').status, 'moved');
  assert.equal(moveReadbackStatus(pageState(null, null), from, to, 'snap5').status, 'missing');
  assert.equal(moveReadbackStatus(pageState('snap5', 'other'), from, to, 'snap5').status, 'conflict');
});

test('normalizes Companion surfaces and validates their usable coordinate window', () => {
  const surface = normalizeSurface('streamdeck:123', { name: 'Monitor Deck', type: 'Elgato Stream Deck +', enabled: true, gridSize: { columns: 4, rows: 4 }, config: { rotation: 0, xOffset: 2, yOffset: 1 } });
  assert.deepEqual(surface, { id: 'streamdeck:123', name: 'Monitor Deck', type: 'Elgato Stream Deck +', columns: 4, rows: 4, xOffset: 2, yOffset: 1, rotation: 0, enabled: true, connected: true, satellite: false, location: null });
  assert.equal(surfaceCompatibility(surface, { page: 1, row: 2, column: 3 }).compatible, true);
  assert.equal(surfaceCompatibility(surface, { page: 1, row: 4, column: 5 }).compatible, true);
  assert.equal(surfaceCompatibility(surface, { page: 1, row: 0, column: 3 }).compatible, false);
  assert.match(surfaceCompatibility(surface, { page: 1, row: 2, column: 6 }).reason, /outside Monitor Deck's Companion-aligned grid/);
});

test('identifies Companion Satellite surfaces and retains their network location', () => {
  const surface = normalizeSurface('satellite:remote:deck1', { name: 'FOH Remote', type: 'Stream Deck', location: '192.168.20.41', gridSize: { columns: 5, rows: 3 } });
  assert.equal(surface.satellite, true);
  assert.equal(surface.location, '192.168.20.41');
});

test('reconciles Companion Satellite runtime suffixes without changing the configured surface id', () => {
  assert.equal(satelliteSurfaceBaseId('streamdeck:AL50H1C13564-dev2'), 'streamdeck:AL50H1C13564');
  const configured = [{ id: 'streamdeck:AL50H1C13564', satellite: true, connected: false, location: null }];
  const reconciled = reconcileSatelliteSurfaces(configured, { connected: true }, [{ surfaceId: 'streamdeck:AL50H1C13564-dev2' }], '169.254.204.232');
  assert.deepEqual(reconciled[0], { id: 'streamdeck:AL50H1C13564', satellite: true, connected: true, location: '169.254.204.232', satelliteRuntimeId: 'streamdeck:AL50H1C13564-dev2' });
  assert.equal(reconcileSatelliteSurfaces(configured, { connected: false }, [{ surfaceId: 'streamdeck:AL50H1C13564-dev2' }], '169.254.204.232')[0].connected, false);
});

test('swaps surface dimensions for quarter-turn rotations', () => {
  const surface = normalizeSurface('streamdeck:rotated', { gridSize: { columns: 5, rows: 3 }, config: { rotation: 90 } });
  assert.equal(surface.columns, 3);
  assert.equal(surface.rows, 5);
});

test('maps physical rotary locations for Stream Deck encoder surfaces', () => {
  assert.deepEqual(surfaceRotaryLocations({ type: 'Elgato Stream Deck +', columns: 4, rows: 4 }), [
    { row: 4, column: 1 }, { row: 4, column: 2 }, { row: 4, column: 3 }, { row: 4, column: 4 },
  ]);
  assert.deepEqual(surfaceRotaryLocations({ type: 'Elgato Stream Deck Studio', columns: 18, rows: 2 }), [
    { row: 1, column: 1 }, { row: 1, column: 18 },
  ]);
  assert.deepEqual(surfaceRotaryLocations({ type: 'Elgato Stream Deck', columns: 5, rows: 3 }), []);
});

test('normalizes the serialized map shape used by Companion surface subscriptions', () => {
  const serializedSurface = ['streamdeck:A00WA3361M8P5X', { name: 'Stream Deck1', type: 'Elgato Stream Deck +', enabled: true, gridSize: { columns: 4, rows: 4 }, config: { rotation: 0, xOffset: 0, yOffset: 0 } }];
  const surface = normalizeSurface(...serializedSurface);
  assert.equal(surface.id, 'streamdeck:A00WA3361M8P5X');
  assert.equal(surface.name, 'Stream Deck1');
  assert.equal(surface.columns, 4);
  assert.equal(surface.rows, 4);
});

test('reads configured surfaces from the local Companion 5 registry without inventing USB state', async () => {
  const surfaces = await discoverLocalSurfaces();
  const streamDeck = surfaces.find((surface) => surface.id === 'streamdeck:A00WA3361M8P5X');
  assert.ok(streamDeck);
  assert.equal(typeof streamDeck.connected, 'boolean');
});

test('maps plans to digico_osc 1.0.4 action definitions', () => {
  assert.deepEqual(actionDefinitions({ family: 'channel-mute', operation: 'mute', channels: [36] }), [{ definitionId: 'mute', options: { channel: 36, mute: '1' } }]);
  assert.deepEqual(actionDefinitions({ family: 'aux-mute', operation: 'unmute', auxes: [4] }), [{ definitionId: 'auxmute', options: { channel: 4, auxmute: '0' } }]);
  assert.deepEqual(actionDefinitions({ family: 'control-group-mute', operation: 'mute', controlGroups: [6] }), [{ definitionId: 'cgmute', options: { channel: 6, cgmute: '1' } }]);
  assert.deepEqual(actionDefinitions({ family: 'channel-fader', operation: 'set-fader', channels: [12], levelDb: 'OFF' }), [{ definitionId: 'fader', options: { channel: 12, fader: -150 } }]);
});

test('maps Generic MIDI actions to the installed 1.4.0 definitions', () => {
  assert.deepEqual(actionDefinitions({ family: 'midi', operation: 'noteon', channel: 10, note: 36, velocity: 110 }), [{ definitionId: 'noteon', options: { channel: 10, note: 36, velocity: 110, useVariables: false, relValue: false, sendOverTime: false } }]);
  assert.deepEqual(actionDefinitions({ family: 'midi', operation: 'cc', channel: 2, controller: 7, value: 100 })[0].options.controller, 7);
  assert.equal(actionManifest({ family: 'midi', operation: 'program', channel: 1, program: 12 })[0].actionId, 'program');
  const momentary = actionDefinitions({ family: 'midi', operation: 'momentary-cc', channel: 1, press: { controller: 12, value: 127 }, release: { controller: 14, value: 0 } });
  assert.deepEqual(momentary.map(({ phase, options }) => [phase, options.controller, options.value]), [['press', 12, 127], ['release', 14, 0]]);
  assert.deepEqual(actionManifest({ family: 'midi', operation: 'momentary-cc', channel: 1, press: { controller: 12, value: 127 }, release: { controller: 14, value: 0 } }).map((item) => item.phase), ['press', 'release']);
});

test('builds a text manifest for every action and toggle step', () => {
  const manifest = actionManifest({ family: 'channel-mute', operation: 'toggle-mute', channels: [1, 3] });
  assert.equal(manifest.length, 4);
  assert.deepEqual(manifest.map((item) => item.step), [1, 1, 2, 2]);
  assert.equal(manifest[0].summary, 'Channel 1: mute ON');
  assert.equal(manifest[2].summary, 'Channel 1: mute OFF');
});

test('maps state colors to Companion current-step feedback overrides', () => {
  const feedback = toggleStateFeedbackDefinition({ states: { muted: { textColor: '#ffffff', backgroundColor: '#ff0000' } } });
  assert.equal(feedback.connectionId, 'internal');
  assert.equal(feedback.definitionId, 'bank_current_step');
  assert.equal(feedback.options.step, 2);
  assert.deepEqual(feedback.overrides.map((entry) => entry.override.value), [0xff0000, 0xffffff]);
});

test('maps snapshot commands to digico_osc snapshot actions', () => {
  assert.deepEqual(actionDefinitions({ family: 'snapshot', operation: 'fire-snapshot', snapshot: 1 }), [{ definitionId: 'snapshot', options: { snapshot: 1 } }]);
  assert.deepEqual(actionDefinitions({ family: 'snapshot', operation: 'next-snapshot' }), [{ definitionId: 'snapshotNext', options: {} }]);
  assert.deepEqual(actionDefinitions({ family: 'snapshot', operation: 'previous-snapshot' }), [{ definitionId: 'snapshotPrev', options: {} }]);
});

test('maps macro commands to the digico_osc macro action', () => {
  assert.deepEqual(actionDefinitions({ family: 'macro', operation: 'fire-macro', macro: 25 }), [{ definitionId: 'macros', options: { macro: 25 } }]);
});

test('summarizes programmed Companion actions while excluding feedbacks', () => {
  const config = { steps: { 0: { actionSets: { down: [{ entityType: 'action', definitionId: 'mute', options: { channel: 36, mute: '1' } }] } } }, feedbacks: [{ entityType: 'feedback', definitionId: 'mute', options: { channel: 36 } }] };
  assert.deepEqual(summarizeControlActions(config), ['Step 1 · Channel mute · channel 36, mute 1']);
  assert.deepEqual(extractControlActions(config), [{ step: 1, definitionId: 'mute', options: { channel: 36, mute: '1' } }]);
});

test('retains the target connection ID while reading existing Companion actions', () => {
  const config = { steps: { 0: { actionSets: { down: [{ entityType: 'action', connectionId: 'digico-main', definitionId: 'mute', options: { channel: 7, mute: '1' } }] } } } };
  assert.deepEqual(extractControlActions(config), [{ step: 1, connectionId: 'digico-main', definitionId: 'mute', options: { channel: 7, mute: '1' } }]);
});
