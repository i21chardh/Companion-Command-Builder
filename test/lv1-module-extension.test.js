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

test('LV1 1.1.3 scopes persisted relative state to the stable LV1 host', async () => {
  const patch = await readFile(join(integrationRoot, 'waves-lv1-1.1.3-stable-endpoint-cache.patch'), 'utf8');
  assert.match(patch, /replace\(\/:\\d\+\$\/, ''\)/);
  assert.match(patch, /LV1's discovery port is session-scoped/);
  assert.match(patch, /Accept the 1\.1\.2 host:port scope once/);
  assert.match(patch, /return String\(config\.host \|\| selectedHost\)\.trim\(\)\.toLowerCase\(\)/);
});

