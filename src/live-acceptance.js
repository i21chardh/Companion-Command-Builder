export const REQUIRED_LIVE_WORKFLOWS = Object.freeze([
  {
    id: 'axient-slot-rf-power',
    moduleId: 'shure-wireless',
    versions: ['2.3.1'],
    acceptedModels: ['ad4d', 'ad4q'],
    actionId: 'slot_rf_power',
    options: { slot: '1:1', power: 'NORMAL' },
    prompt: 'add a button at 1.0.3 for axient slot 1 rf power',
  },
]);

function parseRows(rows) {
  return (rows || []).map((entry) => {
    try { return { id: entry.id, ...(typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value) }; }
    catch { return null; }
  }).filter(Boolean);
}

function containsAction(value, connectionId, actionId) {
  if (!value || typeof value !== 'object') return false;
  if (value.connectionId === connectionId && value.definitionId === actionId) return true;
  return Object.values(value).some((child) => containsAction(child, connectionId, actionId));
}

export function auditRequiredLiveConnections(instances, requirements = REQUIRED_LIVE_WORKFLOWS, controls = [], evidence = []) {
  const connections = parseRows(instances).filter((entry) => entry?.moduleInstanceType === 'connection' && entry.enabled !== false);
  const storedControls = parseRows(controls);
  const results = requirements.map((requirement) => {
    const connection = connections.find((entry) => entry.moduleId === requirement.moduleId && requirement.versions.includes(entry.moduleVersionId));
    if (!connection) return { ...requirement, status: 'fail', reason: `No enabled ${requirement.moduleId} ${requirement.versions.join(' or ')} connection is configured.` };
    const model = String(connection.config?.modelID || '').toLowerCase();
    if (requirement.acceptedModels?.length && !requirement.acceptedModels.includes(model)) return {
      ...requirement, status: 'fail', connectionId: connection.id, connectionLabel: connection.label, configuredModel: model || 'unspecified',
      reason: `${connection.label || requirement.moduleId} is configured as ${model || 'an unspecified model'}; ${requirement.actionId} requires ${requirement.acceptedModels.map((item) => item.toUpperCase()).join(' or ')}.`,
    };
    const storedReadback = storedControls.find((control) => containsAction(control, connection.id, requirement.actionId));
    const temporaryReadback = evidence.find((item) => item.workflowId === requirement.id
      && item.connectionId === connection.id && item.actionId === requirement.actionId
      && item.verified === true && item.cleanedUp === true);
    return {
      ...requirement,
      status: storedReadback || temporaryReadback ? 'passed' : 'ready-for-readback',
      connectionId: connection.id,
      connectionLabel: connection.label,
      configuredModel: model,
      ...(storedReadback ? { controlId: storedReadback.id } : {}),
      ...(temporaryReadback ? { evidence: 'temporary-readback', readback: temporaryReadback } : {}),
    };
  });
  const gate = results.every((item) => item.status === 'passed')
    ? 'PASS'
    : results.every((item) => item.status === 'ready-for-readback' || item.status === 'passed') ? 'READY-FOR-LIVE-READBACK' : 'FAIL';
  return { gate, results };
}
