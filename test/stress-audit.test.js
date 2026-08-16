import test from 'node:test';
import assert from 'node:assert/strict';
import { runStressAudit } from '../work/stress-audit.js';

test('historical CCB regressions remain covered by the offline stress gate', () => {
  const report = runStressAudit();
  assert.ok(report.totals.cases >= 20);
  assert.equal(report.totals.failed, 0, report.results.filter((item) => item.status === 'fail').map((item) => `${item.id}: ${(item.mismatches || []).join('; ')}`).join('\n'));
  assert.ok(report.liveWorkflows.some((item) => item.id === 'render-color-matrix'));
  assert.ok(report.liveWorkflows.some((item) => item.id === 'save-load-roundtrip'));
});

