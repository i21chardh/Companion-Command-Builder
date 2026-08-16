import { access, readFile, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ADAPTERS } from './index.js';
import { adapterDevelopmentQueue } from './catalog.js';

export const TARGET_MODULES = Object.freeze(['obs-studio', 'bmd-atem', 'generic-midi', 'generic-osc', 'waves-lv1', 'figure53-qlab-advance']);
const execFileAsync = promisify(execFile);

async function localCompanionListener(address) {
  const match = /^(?:127\.0\.0\.1|localhost):([0-9]+)$/.exec(address);
  if (!match) return false;
  try {
    const { stdout } = await execFileAsync('/usr/sbin/lsof', ['-nP', `-iTCP:${match[1]}`, '-sTCP:LISTEN']);
    return stdout.includes(`:${match[1]} (LISTEN)`);
  } catch { return false; }
}

export function validateAdapterManifest(adapter) {
  const errors = [];
  for (const key of ['moduleId', 'displayName', 'category', 'verification']) {
    if (!adapter?.[key] || typeof adapter[key] !== 'string') errors.push(`${key} is required`);
  }
  if (!Array.isArray(adapter?.supportedVersions) || !adapter.supportedVersions.length) errors.push('supportedVersions must not be empty');
  if (!Array.isArray(adapter?.capabilities) || !adapter.capabilities.length) errors.push('capabilities must not be empty');
  if (!Array.isArray(adapter?.graphics)) errors.push('graphics must be an array');
  return errors;
}

async function installedModule(moduleId, modulesRoot) {
  const directories = await readdir(modulesRoot).catch(() => []);
  const matches = directories.filter((name) => name.startsWith(`${moduleId}-`)).sort().reverse();
  if (!matches.length) return null;
  const directory = join(modulesRoot, matches[0]);
  const manifestPath = join(directory, 'companion', 'manifest.json');
  await access(manifestPath, constants.R_OK);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  return { directory, manifest };
}

export async function discoverInstalledModules(modulesRoot = join(homedir(), 'Library', 'Application Support', 'companion', 'modules')) {
  const directories = await readdir(modulesRoot).catch(() => []);
  const modules = [];
  for (const directoryName of directories.sort()) {
    const manifestPath = join(modulesRoot, directoryName, 'companion', 'manifest.json');
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (manifest.type && manifest.type !== 'connection') continue;
      if (!manifest.id || !manifest.version) continue;
      modules.push({
        moduleId: manifest.id,
        version: manifest.version,
        versionId: manifest.version,
        product: manifest.products?.[0] || manifest.name || manifest.id,
        products: manifest.products || [],
        name: manifest.manufacturer && manifest.products?.length
          ? `${manifest.manufacturer}: ${manifest.products.join('; ')}`
          : manifest.name || manifest.id,
      });
    } catch {}
  }
  return modules;
}

export async function runAdapterAudit({
  modulesRoot = join(homedir(), 'Library', 'Application Support', 'companion', 'modules'),
  companionAddress = '127.0.0.1:8000',
  targets = TARGET_MODULES,
} = {}) {
  let companionOnline = false;
  try {
    const response = await fetch(`http://${companionAddress}/`, { signal: AbortSignal.timeout(1500) });
    companionOnline = response.ok;
  } catch {}
  if (!companionOnline) companionOnline = await localCompanionListener(companionAddress);
  const queue = new Map(adapterDevelopmentQueue().map((entry) => [entry.moduleId, entry]));
  const results = [];
  for (const moduleId of targets) {
    const installed = await installedModule(moduleId, modulesRoot);
    const adapter = ADAPTERS.get(moduleId);
    const schemaErrors = adapter ? validateAdapterManifest(adapter) : ['adapter manifest has not been implemented'];
    const version = installed?.manifest?.version || null;
    const versionMatched = Boolean(adapter && version && adapter.supportedVersions.includes(version));
    results.push({
      moduleId,
      name: adapter?.displayName || queue.get(moduleId)?.name || moduleId,
      installed: Boolean(installed),
      installedVersion: version,
      adapterImplemented: Boolean(adapter),
      schemaPassed: schemaErrors.length === 0,
      schemaErrors,
      versionMatched,
      liveDeployment: companionOnline && installed && versionMatched ? 'ready-to-run' : 'blocked',
      blocker: !installed ? 'Module is not installed in this Companion instance.'
        : !adapter ? 'CCB adapter is not implemented.'
          : !versionMatched ? `Installed ${version}; audited versions: ${adapter.supportedVersions.join(', ')}.`
            : !companionOnline ? 'Companion is offline.' : null,
    });
  }
  return { generatedAt: new Date().toISOString(), companionAddress, companionOnline, results };
}
