import { appendFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const MAX_LOG_BYTES = 2 * 1024 * 1024;
const SECRET_PATTERN = /(api[-_ ]?key|authorization|password|passcode|pin|secret|token)(["'\s:=]+)([^\s,;"'}]+)/gi;

export const systemLogPath = process.env.CCB_LOG_PATH
  || join(homedir(), 'Library', 'Logs', 'Companion Command Builder', 'system.log');

export function redactLogValue(value) {
  if (value === undefined) return undefined;
  let serialized;
  try { serialized = typeof value === 'string' ? value : JSON.stringify(value); }
  catch { serialized = String(value); }
  return serialized.replace(SECRET_PATTERN, '$1$2[REDACTED]');
}

async function rotateIfNeeded() {
  try {
    if ((await stat(systemLogPath)).size < MAX_LOG_BYTES) return;
    await rename(systemLogPath, `${systemLogPath}.previous`).catch(async () => {
      await writeFile(systemLogPath, '', 'utf8');
    });
  } catch {}
}

export async function writeSystemLog(level, event, details = {}) {
  await mkdir(dirname(systemLogPath), { recursive: true });
  await rotateIfNeeded();
  const entry = {
    time: new Date().toISOString(),
    level: String(level || 'info').toUpperCase(),
    event: String(event || 'application-event').slice(0, 160),
    details,
  };
  await appendFile(systemLogPath, `${redactLogValue(entry)}\n`, 'utf8');
  return entry;
}

export async function readSystemLog({ lines = 300 } = {}) {
  const limit = Math.max(1, Math.min(2000, Number(lines) || 300));
  const content = await readFile(systemLogPath, 'utf8').catch((error) => error.code === 'ENOENT' ? '' : Promise.reject(error));
  return content.split('\n').filter(Boolean).slice(-limit).join('\n');
}

export async function clearSystemLog() {
  await mkdir(dirname(systemLogPath), { recursive: true });
  await writeFile(systemLogPath, '', 'utf8');
}
