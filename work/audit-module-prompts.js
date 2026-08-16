#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseCommand } from '../src/parser.js';
import { buildDeploymentPlan } from '../src/plan.js';
import { defaultConfig } from '../src/config.js';
import { modulePromptCases } from '../src/adapters/prompt-corpus.js';

const results = modulePromptCases().map((testCase) => {
  try {
    const parsed = parseCommand(testCase.prompt);
    const plan = buildDeploymentPlan(parsed, defaultConfig);
    const correctModule = plan.module?.id === testCase.moduleId;
    return { ...testCase, status: correctModule ? 'pass' : 'wrong-module', actualModule: plan.module?.id || null };
  } catch (error) {
    return { ...testCase, status: 'needs-implementation', error: error.message };
  }
});

const byModule = Object.fromEntries([...new Set(results.map((item) => item.moduleId))].map((moduleId) => {
  const cases = results.filter((item) => item.moduleId === moduleId);
  return [moduleId, {
    total: cases.length,
    passed: cases.filter((item) => item.status === 'pass').length,
    wrongModule: cases.filter((item) => item.status === 'wrong-module').length,
    needsImplementation: cases.filter((item) => item.status === 'needs-implementation').length,
  }];
}));
const report = { generatedAt: new Date().toISOString(), totals: { cases: results.length, passed: results.filter((item) => item.status === 'pass').length }, byModule, results };
await writeFile(new URL('./module-prompt-audit-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ totals: report.totals, byModule }, null, 2));
