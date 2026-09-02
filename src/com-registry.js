import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { normalizeComEndpointId } from './peer-intercom.js';

export const DEFAULT_COM_REGISTRY = join(homedir(), 'Library', 'Application Support', 'Companion Command Builder', 'com-endpoints.json');

export async function readComRegistry(path = DEFAULT_COM_REGISTRY) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    return { version: 1, endpoints: Array.isArray(value.endpoints) ? value.endpoints : [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, endpoints: [] };
    throw error;
  }
}

async function saveComRegistry(registry, path = DEFAULT_COM_REGISTRY) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

export async function nextComEndpointId(path = DEFAULT_COM_REGISTRY) {
  const registry = await readComRegistry(path);
  const largest = registry.endpoints.reduce((max, endpoint) => Math.max(max, Number(String(endpoint.id || '').match(/^COM-(\d+)$/)?.[1] || 0)), 0);
  return `COM-${String(largest + 1).padStart(4, '0')}`;
}

export async function registerComEndpoint(endpoint, path = DEFAULT_COM_REGISTRY) {
  const registry = await readComRegistry(path);
  const normalized = { ...endpoint, id: normalizeComEndpointId(endpoint.id), updatedAt: new Date().toISOString() };
  const index = registry.endpoints.findIndex((item) => item.id === normalized.id);
  if (index >= 0) registry.endpoints[index] = normalized; else registry.endpoints.push(normalized);
  registry.endpoints.sort((a, b) => a.id.localeCompare(b.id));
  await saveComRegistry(registry, path);
  return normalized;
}

export async function unregisterComEndpoint(id, path = DEFAULT_COM_REGISTRY) {
  const registry = await readComRegistry(path);
  const endpointId = normalizeComEndpointId(id);
  const before = registry.endpoints.length;
  registry.endpoints = registry.endpoints.filter((item) => item.id !== endpointId);
  await saveComRegistry(registry, path);
  return before !== registry.endpoints.length;
}

export function comEndpointFromPlans(plans, address) {
  const pair = plans.filter((plan) => plan.intercom?.endpointId);
  if (!pair.length || !pair.some((plan) => plan.intercom.role === 'call') || !pair.some((plan) => plan.intercom.role === 'alarm')) return null;
  const first = pair[0];
  return {
    id: first.intercom.endpointId, name: first.intercom.endpointName, companionAddress: address,
    surfaceId: first.targetSurfaceId, targetEndpointId: first.intercom.targetEndpointId || '',
    actionConfig: first.intercom.actionConfig || null,
    buttons: Object.fromEntries(pair.map((plan) => [plan.intercom.role, plan.button.location])),
  };
}
