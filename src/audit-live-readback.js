import { auditRequiredLiveConnections, REQUIRED_LIVE_WORKFLOWS } from './live-acceptance.js';
import { compileDynamicAdapter } from './adapters/dynamic.js';
import { discoverConnectionDefinitions, discoverSurfaces, validateDynamicAdapterReadback } from './companion.js';

export async function auditLiveReadback({ address = '127.0.0.1:8000', instances = [], requirements = REQUIRED_LIVE_WORKFLOWS, dependencies = {} } = {}) {
  const discoverDefinitions = dependencies.discoverConnectionDefinitions || discoverConnectionDefinitions;
  const findSurfaces = dependencies.discoverSurfaces || discoverSurfaces;
  const validateReadback = dependencies.validateDynamicAdapterReadback || validateDynamicAdapterReadback;
  const initial = auditRequiredLiveConnections(instances, requirements, [], []);
  if (initial.gate === 'FAIL') return { cases: initial.results.map((item) => ({ ...item, status: item.status === 'fail' ? 'fail' : 'pending' })) };
  const surfaces = await findSurfaces(address);
  const surface = surfaces.find((item) => item.enabled !== false && item.connected !== false);
  if (!surface) return { cases: initial.results.map((item) => ({ ...item, status: 'fail', reason: 'No connected surface is available for temporary read-back.' })) };
  const evidence = [];
  for (const workflow of initial.results.filter((item) => item.status === 'ready-for-readback')) {
    try {
      const definitions = await discoverDefinitions(address, workflow.connectionId);
      const adapter = compileDynamicAdapter({ moduleId: workflow.moduleId, version: workflow.versions[0], name: workflow.connectionLabel || workflow.moduleId }, definitions);
      const readback = await validateReadback(address, workflow.connectionId, surface, 1, adapter, { actionId: workflow.actionId, options: workflow.options || {} });
      evidence.push({ workflowId: workflow.id, connectionId: workflow.connectionId, actionId: workflow.actionId, ...readback });
    } catch (error) {
      evidence.push({ workflowId: workflow.id, connectionId: workflow.connectionId, actionId: workflow.actionId, verified: false, cleanedUp: false, error: error.message || String(error) });
    }
  }
  const final = auditRequiredLiveConnections(instances, requirements, [], evidence);
  return { cases: final.results.map((item) => {
    const proof = evidence.find((entry) => entry.workflowId === item.id);
    return item.status === 'passed' ? { ...item, status: 'pass' } : { ...item, status: 'fail', reason: proof?.error || item.reason || 'Temporary read-back did not pass.' };
  }), evidence };
}
