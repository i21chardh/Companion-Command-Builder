import test from 'node:test';
import assert from 'node:assert/strict';
import { companionSafeFontPercent, recolorCompanionFrame, resolveCompanionGraphic, rgbaFrameLooksBlank } from '../public/appearance.js';

test('fits button labels without splitting full words unnecessarily', () => {
  assert.equal(companionSafeFontPercent('STOP', 'auto'), 45);
  assert.equal(companionSafeFontPercent('WAVES', 100), 36);
});

test('identifies blank Companion frames while retaining rendered text frames', () => {
  assert.equal(rgbaFrameLooksBlank(new Uint8ClampedArray([8, 12, 19, 255, 9, 13, 20, 255])), true);
  assert.equal(rgbaFrameLooksBlank(new Uint8ClampedArray([0, 0, 0, 255, 17, 39, 146, 255])), false);
  assert.equal(rgbaFrameLooksBlank(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 0])), true);
});

test('reuses the last verified control graphic when a moved location renders blank', () => {
  assert.equal(resolveCompanionGraphic('black-frame', { blank: true, verified: 'waves-source-frame' }), 'waves-source-frame');
  assert.equal(resolveCompanionGraphic('updated-feedback-frame', { blank: false, verified: 'waves-source-frame' }), 'updated-feedback-frame');
  assert.equal(resolveCompanionGraphic('black-frame', { blank: true, verified: null }), null);
});

test('recolors an exact Companion frame without changing glyph geometry or alpha', () => {
  const source = new Uint8ClampedArray([
    0, 0, 0, 255,
    128, 128, 128, 180,
    255, 255, 255, 255,
    255, 0, 255, 255,
  ]);
  const recolored = recolorCompanionFrame(source, {
    sourceTextColor: '#ffffff',
    sourceBackgroundColor: '#000000',
    targetTextColor: '#ffff00',
    targetBackgroundColor: '#0000ff',
  });
  assert.deepEqual([...recolored.slice(0, 4)], [0, 0, 255, 255]);
  assert.deepEqual([...recolored.slice(4, 8)], [128, 128, 127, 180]);
  assert.deepEqual([...recolored.slice(8, 12)], [255, 255, 0, 255]);
  assert.deepEqual([...recolored.slice(12, 16)], [255, 0, 255, 255]);
});
