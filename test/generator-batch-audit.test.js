import test from 'node:test';
import assert from 'node:assert/strict';
import { auditGeneratorBatches, GENERATOR_BATCHES } from '../work/audit-generator-batches.js';

test('audits multi-button generator batches across OBS, QLab, and DiGiCo', () => {
  const results = auditGeneratorBatches();
  assert.equal(results.length, GENERATOR_BATCHES.length);
  assert.ok(results.every((result) => result.status === 'pass' && result.commands === 3));
});

