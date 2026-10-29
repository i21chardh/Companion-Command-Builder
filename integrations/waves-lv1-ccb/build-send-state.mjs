import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build from the CCB 1.1.3 module package. Fails before writing when the expected
// action shape is absent; never silently patches a different installed version.
const [sourceArg, targetArg] = process.argv.slice(2);
if (!sourceArg || !targetArg) throw new Error('Usage: node build-send-state.mjs <waves-lv1-1.1.3 package> <new empty package folder>');
const source = resolve(sourceArg), target = resolve(targetArg);
const meta = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
if (meta.name !== 'waves-lv1' || meta.version !== '1.1.3') throw new Error('Expected the CCB waves-lv1 1.1.3 package');
let main = await readFile(join(source, 'main.js'), 'utf8');
const start = main.indexOf('sendGainRelative:{');
const end = main.indexOf('fadeFader:{', start);
const original = main.slice(start, end);
const replacement = original.replace(/,i=e\.sends\.get[\s\S]*?const o=await xe\(t.options,"delta",n,1\),a=Ae[\s\S]*?\]\)\}\},$/, ';const o=await xe(t.options,"delta",n,1);await e.adjustRelativeSend(s,r,o)}},');
if (start < 0 || end < 0 || replacement === original || replacement.includes('e.sends.get')) throw new Error('Unexpected relative-send action implementation');
main = main.slice(0, start) + replacement + main.slice(end);
const bootstrap = '(0,S().runEntrypoint)(je,[])';
if (!main.includes(bootstrap)) throw new Error('Expected LV1 entrypoint not found');
main = main.replace(bootstrap, 'require("./ccb-send-state.cjs")(je);' + bootstrap);
await mkdir(target); // Existing output is deliberately rejected.
await cp(source, target, { recursive: true });
await writeFile(join(target, 'main.js'), main);
await cp(join(dirname(fileURLToPath(import.meta.url)), 'send-state.cjs'), join(target, 'ccb-send-state.cjs'));
for (const path of ['package.json', 'companion/manifest.json']) {
  const file = join(target, path);
  const value = JSON.parse(await readFile(file, 'utf8'));
  value.version = '1.1.4';
  await writeFile(file, JSON.stringify(value));
}
