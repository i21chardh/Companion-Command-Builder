import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('macOS packaging pins the launcher and metadata to the bundled runtime minimum', async () => {
  const [script, plist] = await Promise.all([
    readFile(new URL('../packaging/build-dmg.sh', import.meta.url), 'utf8'),
    readFile(new URL('../packaging/macos/Info.plist', import.meta.url), 'utf8'),
  ]);
  assert.match(script, /builder_minimum_macos="13\.5"/);
  assert.match(script, /-target "arm64-apple-macos\$\{builder_minimum_macos\}"/);
  assert.match(script, /builder_launcher_minos/);
  assert.match(script, /builder_declared_minos/);
  assert.match(plist, /<key>LSMinimumSystemVersion<\/key><string>13\.5<\/string>/);
});
