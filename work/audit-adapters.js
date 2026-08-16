#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { runAdapterAudit } from '../src/adapters/audit.js';

const report = await runAdapterAudit();
const output = `${JSON.stringify(report, null, 2)}\n`;
await writeFile(new URL('./adapter-audit-report.json', import.meta.url), output);
console.log(output);
if (report.results.some((item) => item.adapterImplemented && !item.schemaPassed)) process.exitCode = 1;
