import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReferencedStyle, styleReferenceLocation } from '../src/style-reference.js';

test('copies appearance but not actions from a referenced Companion button', () => {
  const command = 'create a spotify stop button at 1.1.1 thats the same style button as 1.1.0';
  assert.deepEqual(styleReferenceLocation(command), { page: 1, row: 1, column: 0 });
  const plan = { button: { appearance: { textColor: '#fff', backgroundColor: '#000' }, action: { operation: 'pause' } } };
  applyReferencedStyle(plan, { page: 1, row: 1, column: 0, textColor: '#123456', backgroundColor: '#654321', textSize: 44, programmedActions: [{ definitionId: 'play' }] });
  assert.deepEqual(plan.button.appearance, { textColor: '#123456', backgroundColor: '#654321', textSize: 44 });
  assert.deepEqual(plan.button.action, { operation: 'pause' });
});
