import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBulkModuleStylePlans, isBulkModuleStyleCommand, moduleStyle } from '../src/bulk-module-style.js';

const exactPrompt = 'update all buttons on surface with independant color schemes for each module button is associated with';

test('recognizes the reported bulk module-style prompt deterministically', () => {
  assert.equal(isBulkModuleStyleCommand(exactPrompt), true);
});

test('builds independent styles and skips ambiguous module ownership', () => {
  const result = buildBulkModuleStylePlans({
    command: exactPrompt, pageNumber: 1, surface: { xOffset: 0, yOffset: 0, columns: 5, rows: 3 },
    connections: [{ id: 'reaper-1', moduleId: 'cockos-reaper' }, { id: 'spotify-1', moduleId: 'spotify-remote' }],
    buttons: [
      { row: 0, column: 0, text: 'STOP', textColor: '#ffffff', backgroundColor: '#000000', programmedActions: [{ connectionId: 'reaper-1', definitionId: 'stop' }] },
      { row: 0, column: 1, text: 'NEXT', textColor: '#ffffff', backgroundColor: '#000000', programmedActions: [{ connectionId: 'spotify-1', definitionId: 'next' }] },
      { row: 0, column: 2, text: 'MIXED', programmedActions: [{ connectionId: 'reaper-1' }, { connectionId: 'spotify-1' }] },
    ],
  });
  assert.equal(result.plans.length, 2);
  assert.equal(result.skipped.length, 1);
  assert.deepEqual(result.plans[0].button.appearance, { ...moduleStyle('cockos-reaper'), textSize: 'auto' });
  assert.equal(result.plans[0].button.graphic.symbol, 'RPR');
  assert.equal(result.plans[1].button.graphic.symbol, 'SPOT');
  assert.equal(result.plans[0].button.action.operation, 'preserve');
});
