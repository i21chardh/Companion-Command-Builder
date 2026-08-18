#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { auditRequiredLiveConnections } from '../src/live-acceptance.js';
import { auditLiveReadback } from '../src/audit-live-readback.js';

const execFileAsync = promisify(execFile);
const database = process.env.COMPANION_DATABASE || join(homedir(), 'Library', 'Application Support', 'companion', 'v5.0', 'db.sqlite');

export async function runLiveConnectionAudit(databasePath = database) {
  const [{ stdout: instanceRows }, { stdout: controlRows }] = await Promise.all([
    execFileAsync('/usr/bin/sqlite3', ['-json', databasePath, 'select id,value from instances;'], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 }),
    execFileAsync('/usr/bin/sqlite3', ['-json', databasePath, 'select id,value from controls;'], { timeout: 5000, maxBuffer: 16 * 1024 * 1024 }),
  ]);
  return auditRequiredLiveConnections(JSON.parse(instanceRows || '[]'), undefined, JSON.parse(controlRows || '[]'));
}

export async function readLiveConnectionRows(databasePath = database) {
  const { stdout } = await execFileAsync('/usr/bin/sqlite3', ['-json', databasePath, 'select id,value from instances;'], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout || '[]');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const report = await auditLiveReadback({ instances: await readLiveConnectionRows() });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.cases.some((item) => item.status === 'fail') ? 1 : 0;
}
