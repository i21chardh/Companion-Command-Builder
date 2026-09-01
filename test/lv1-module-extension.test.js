import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const integrationRoot = join(process.cwd(), 'integrations', 'waves-lv1-ccb');

test('LV1 1.1.2 reconnect extension persists only observed relative-control values', async () => {
  const patch = await readFile(join(integrationRoot, 'waves-lv1-1.1.2-reconnect-cache.patch'), 'utf8');
  assert.match(patch, /relativeStateCache/);
  assert.match(patch, /relativeCacheScope/);
  assert.match(patch, /knownOutputGains/);
  assert.match(patch, /knownSendGains/);
  assert.match(patch, /restoreRelativeStateCache/);
  assert.doesNotMatch(patch, /gain:\s*0[^-]/);
});

