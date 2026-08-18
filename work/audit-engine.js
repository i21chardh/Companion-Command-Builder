#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { runAuditEngine } from '../src/audit-engine.js';
import { auditCorrectedCommands, auditOnboardedModuleCommands } from '../src/audit-regressions.js';
import { auditLiveReadback } from '../src/audit-live-readback.js';
import { runStressAudit } from './stress-audit.js';
import { readLiveConnectionRows } from './audit-live-connections.js';

export async function runUnifiedAudit(context = {}) {
  const processes = [
    { id: 'historical-regressions', type: 'offline-regression', run: async () => ({ cases: runStressAudit().results }) },
    { id: 'onboarded-module-commands', type: 'generated-command', run: auditOnboardedModuleCommands },
    { id: 'corrected-commands', type: 'correction-regression', run: auditCorrectedCommands },
    { id: 'live-readback', type: 'temporary-control-readback', run: async (settings) => auditLiveReadback({ ...settings, instances: settings.instances || await readLiveConnectionRows(settings.companionDatabasePath) }) },
  ];
  return runAuditEngine(processes, context);
}
function markdown(report) {
  const processLines = report.processes.map((item) => `- **${item.id}** (${item.type}): ${item.status.toUpperCase()} — ${item.totals.passed} passed, ${item.totals.failed} failed, ${item.totals.pending} pending, ${item.totals.skipped} skipped`).join('\n');
  const failures = report.processes.flatMap((process) => process.cases.filter((item) => item.status === 'fail').map((item) => `- **${process.id}/${item.id}**: ${item.reason || (item.mismatches || []).join('; ') || 'Audit case failed.'}`));
  return `# Companion Command Builder unified audit\n\nGate: **${report.gate}**  \nGenerated: ${report.generatedAt}\n\n## Processes\n\n${processLines}\n\n## Totals\n\n- Cases: ${report.totals.cases}\n- Passed: ${report.totals.passed}\n- Failed: ${report.totals.failed}\n- Pending: ${report.totals.pending}\n- Skipped: ${report.totals.skipped}\n\n## Failures\n\n${failures.length ? failures.join('\n') : '- None'}\n`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const report = await runUnifiedAudit();
  await Promise.all([
    writeFile(new URL('./audit-engine-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(new URL('./audit-engine-report.md', import.meta.url), markdown(report)),
  ]);
  console.log(JSON.stringify({ gate: report.gate, totals: report.totals, processes: report.processes.map(({ id, type, status, totals }) => ({ id, type, status, totals })) }, null, 2));
  process.exitCode = report.totals.failed ? 1 : 0;
}
