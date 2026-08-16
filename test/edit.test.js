import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditPlan, isEditCommand, parseEditCommand } from '../src/edit.js';

test('recognizes and parses existing button font edits', () => {
  assert.equal(isEditCommand('change the font on 1/2/3 to red'), true);
  assert.deepEqual(parseEditCommand('change the font on 1/2/3 to red'), {
    kind: 'edit-button', location: { page: 1, row: 2, column: 3 }, changes: { textColor: '#ff0000' }, sourceText: 'change the font on 1/2/3 to red',
  });
});

test('edits a Companion-native zero-based cell', () => {
  assert.deepEqual(parseEditCommand('change button 1.0.0 background to blue').location, { page: 1, row: 0, column: 0 });
});

test('parses label and background edits together', () => {
  const parsed = parseEditCommand('Update the label on 2/1/4 to "Band TB" and background color to blue');
  assert.deepEqual(parsed.changes, { backgroundColor: '#0000ff', text: 'Band TB' });
});

test('accepts mixed spoken dotted coordinates and two-color cell edits', () => {
  for (const command of [
    'Change cell 1.1.one to blue and purple',
    'Change cell one dot 1 dot one to blue and purple',
    'Change cell one/1/one to blue and purple',
  ]) {
    assert.deepEqual(parseEditCommand(command), {
      kind: 'edit-button',
      location: { page: 1, row: 1, column: 1 },
      changes: { textColor: '#0000ff', backgroundColor: '#800080' },
      sourceText: command,
    });
  }
});

test('renames a button addressed with dotted PAGE.ROW.COLUMN shorthand', () => {
  assert.deepEqual(parseEditCommand('rename 1.2.3 to "waves toggle"'), {
    kind: 'edit-button', location: { page: 1, row: 2, column: 3 }, changes: { text: 'waves toggle' }, sourceText: 'rename 1.2.3 to "waves toggle"',
  });
  assert.equal(parseEditCommand('rename 1/2/3 to Waves Toggle').changes.text, 'Waves Toggle');
});

test('builds a non-destructive edit plan preserving actions', () => {
  const parsed = parseEditCommand('change font on 1/2/3 to red');
  const plan = buildEditPlan(parsed, { text: 'TB', textColor: '#ffffff', backgroundColor: '#000000' }, { product: 'Companion' });
  assert.equal(plan.kind, 'edit-button');
  assert.equal(plan.button.appearance.textColor, '#ff0000');
  assert.equal(plan.button.appearance.backgroundColor, '#000000');
  assert.equal(plan.actions[0].actionId, 'preserved');
});

test('converts an existing mute button to an inverted-color toggle without repeating its channel', () => {
  const parsed = parseEditCommand('can we update 1/2/2 to a toggle button that will invert colors when toggled');
  assert.equal(parsed.changes.operation, 'toggle-mute');
  assert.equal(parsed.changes.invertColors, true);
  const existing = { text: 'Vocal', textColor: '#ffffff', backgroundColor: '#000000', programmedActions: [{ definitionId: 'mute', options: { channel: 7, mute: '1' } }] };
  const plan = buildEditPlan(parsed, existing, { product: 'Companion' });
  assert.equal(plan.kind, 'replace-button');
  assert.deepEqual(plan.module, { id: 'digico_osc', version: '1.0.4', connectionLabel: null });
  assert.deepEqual(plan.button.action.channels, [7]);
  assert.deepEqual(plan.button.appearance.states.muted, { textColor: '#000000', backgroundColor: '#ffffff' });
});

test('accepts dotted coordinates when converting an existing button to an inverted toggle', () => {
  const parsed = parseEditCommand('change button 1.2.1 to toggle and invert colors when toggled');
  assert.deepEqual(parsed.location, { page: 1, row: 2, column: 1 });
  assert.deepEqual(parsed.changes, { operation: 'toggle-mute', invertColors: true });
  const existing = { text: 'TB', textColor: '#ffff00', backgroundColor: '#0000ff', programmedActions: [{ definitionId: 'mute', options: { channel: 36, mute: '1' } }] };
  const plan = buildEditPlan(parsed, existing, { product: 'Companion' });
  assert.deepEqual(plan.button.action.channels, [36]);
  assert.deepEqual(plan.button.appearance.states.muted, { textColor: '#0000ff', backgroundColor: '#ffff00' });
});

test('routes quoted existing-button edits without invoking new-button parsing', () => {
  const command = "'change button 1.2.1 to toggle and invert colors when toggled'";
  assert.equal(isEditCommand(command), true);
  const parsed = parseEditCommand(command);
  assert.deepEqual(parsed.location, { page: 1, row: 2, column: 1 });
  assert.deepEqual(parsed.changes, { operation: 'toggle-mute', invertColors: true });
});

test('updates two-color toggle feedback without converting a macro into mute', () => {
  const parsed = parseEditCommand('update button 1.2.3 to blue and green and toggle the colors when toggling state');
  assert.deepEqual(parsed.changes, { textColor: '#0000ff', backgroundColor: '#008000', invertColors: true, visualToggle: true });
  const existing = { text: 'MACRO 1', textColor: '#ffffff', backgroundColor: '#000000', programmedActions: [{ definitionId: 'macros', options: { macro: 1 } }] };
  const plan = buildEditPlan(parsed, existing, { product: 'Companion' });
  assert.equal(plan.kind, 'replace-button');
  assert.deepEqual(plan.button.appearance.states.muted, { textColor: '#008000', backgroundColor: '#0000ff' });
  assert.deepEqual(plan.button.action, { family: 'macro', operation: 'fire-macro', macro: 1 });
});
