import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('system log persists diagnostics while filtering credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ccb-system-log-'));
  process.env.CCB_LOG_PATH = join(directory, 'system.log');
  const logger = await import(`../src/system-log.js?test=${Date.now()}`);
  await logger.writeSystemLog('error', 'test-failure', { message: 'authorization: Bearer-value', pin: '1418', harmless: 'kept' });
  const content = await logger.readSystemLog({ lines: 10 });
  assert.match(content, /test-failure/);
  assert.match(content, /harmless/);
  assert.doesNotMatch(content, /Bearer-value|1418/);
  assert.match(content, /\[REDACTED\]/);
  assert.equal(content, (await readFile(logger.systemLogPath, 'utf8')).trim());
  await logger.clearSystemLog();
  assert.equal(await logger.readSystemLog(), '');
});
