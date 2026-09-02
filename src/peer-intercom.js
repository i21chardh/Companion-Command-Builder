const LOCATION = /^(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)$/;

export function parseIntercomLocation(value, label, { optional = false } = {}) {
  const text = String(value || '').trim();
  if (!text && optional) return null;
  const match = text.match(LOCATION);
  if (!match) throw new Error(`${label} must use PAGE/ROW/COLUMN, for example 1/0/0.`);
  const location = { page: Number(match[1]), row: Number(match[2]), column: Number(match[3]) };
  if (location.page < 1) throw new Error(`${label} page must be 1 or greater.`);
  return location;
}

function slug(value) {
  return String(value || 'com').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'com';
}

export function normalizeComAddress(value) {
  const address = String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(address)) throw new Error('Peer IP address must be a host or IP address with an optional port.');
  return address;
}

export function normalizeComEndpointId(value) {
  const id = String(value || '').trim().toUpperCase();
  if (!/^COM-\d{4,}$/.test(id)) throw new Error('A valid Com endpoint ID is required.');
  return id;
}

function press(location, name, step = '0') {
  return location ? { connectionId: 'internal', definitionId: 'button_pressrelease', name, step, options: { location: `${location.page}/${location.row}/${location.column}`, force: true } } : null;
}

function setState(variable, value, step = '0') {
  return { connectionId: 'internal', definitionId: 'custom_variable_set_value', name: `Set Com state to ${value}`, step, options: { name: variable, create: true, value } };
}

function configuredDefinitions(input, key, step) {
  return (Array.isArray(input[key]) ? input[key] : []).map((definition) => ({
    ...definition, step, options: { ...definition.options },
  }));
}

function plan({ endpoint, target, location, text, color, definitions, variable, feedbacks, behavior, role, companionAddress }) {
  return {
    kind: 'create-button', schemaVersion: 1,
    target: { product: 'Bitfocus Companion', version: '5.0.3' },
    module: { id: 'internal', version: '5.0.3', name: 'Companion Internal' },
    safety: { overwriteExisting: false, requireConfirmation: true },
    targetSurfaceId: endpoint.surfaceId,
    intercom: {
      endpointId: endpoint.id, endpointName: endpoint.name, targetEndpointId: target?.id || '',
      targetEndpointName: target?.name || '', companionAddress, surfaceId: endpoint.surfaceId,
      actionConfig: endpoint.actionConfig || null,
      role, stateVariable: `custom:${variable}`, configurationPending: !target,
    },
    button: {
      location, text,
      appearance: { textColor: '#ffffff', backgroundColor: color },
      action: { family: 'peer-intercom', operation: role, definitions: definitions.filter(Boolean) },
      feedback: { family: 'peer-intercom-state', variable: `custom:${variable}`, states: feedbacks },
      behavior,
    },
    deployment: { status: 'ready', reason: target ? 'Uses validated Companion internal state, button-trigger, and variable-feedback definitions.' : 'Com pair is ready in local self-test mode; choose another registered endpoint later to route CALL.' },
  };
}

function endpointInput(input = {}) {
  const endpoint = input.endpoint || {};
  const id = normalizeComEndpointId(endpoint.id || input.endpointId);
  const name = String(endpoint.name || input.name || id).trim();
  if (!endpoint.surfaceId) throw new Error(`${name} requires a Device ID / workspace surface.`);
  return {
    id, name, surfaceId: String(endpoint.surfaceId),
    call: parseIntercomLocation(endpoint.call, `${name} Call position`),
    alarm: parseIntercomLocation(endpoint.alarm, `${name} Alarm position`),
    on1: parseIntercomLocation(endpoint.on1, `${name} ON command 1`, { optional: true }),
    off1: parseIntercomLocation(endpoint.off1, `${name} OFF command 1`, { optional: true }),
    on2: parseIntercomLocation(endpoint.on2, `${name} ON command 2`, { optional: true }),
    off2: parseIntercomLocation(endpoint.off2, `${name} OFF command 2`, { optional: true }),
    actionConfig: endpoint.actionConfig || input.actionConfig || null,
  };
}

export function buildComEndpointPlans(input = {}) {
  const endpoint = endpointInput(input);
  const rawTarget = input.targetEndpoint || null;
  const target = rawTarget?.id ? { id: normalizeComEndpointId(rawTarget.id), name: String(rawTarget.name || rawTarget.id).trim() } : null;
  if (target?.id === endpoint.id) throw new Error('A Com pair cannot connect to itself. Choose another registered endpoint.');
  const companionAddress = normalizeComAddress(input.peerAddress || input.companionAddress || '127.0.0.1:8000');
  const ownVariable = comStateVariable(endpoint.id);
  const targetVariable = comStateVariable(target?.id || endpoint.id);
  const plans = [
    plan({ endpoint, target, location: endpoint.call, text: `CALL\n${target?.name || 'SELF TEST'}`, color: '#174b7a', variable: targetVariable,
      feedbacks: [{ values: ['ringing'], backgroundColor: '#0066cc' }, { values: ['connected'], backgroundColor: '#008000' }], role: 'call', companionAddress,
      definitions: [setState(targetVariable, 'ringing')], behavior: target ? `Call ${target.name} (${target.id}) and raise its flashing Alarm.` : `Local self-test for ${endpoint.id}; select another registered Com endpoint later.` }),
    plan({ endpoint, target, location: endpoint.alarm, text: `ALARM\n${endpoint.id}`, color: '#351217', variable: ownVariable,
      feedbacks: [{ values: ['ringing'], backgroundColor: '#ff0000', flash: true }, { values: ['connected'], backgroundColor: '#008000' }], role: 'alarm', companionAddress,
      definitions: [setState(ownVariable, 'connected', '0'), ...configuredDefinitions(input, 'answerDefinitions', '0'), press(endpoint.on1, `${endpoint.name} ON command 1`, '0'), press(endpoint.on2, `${endpoint.name} ON command 2`, '0'), ...configuredDefinitions(input, 'resetDefinitions', '1'), press(endpoint.off1, `${endpoint.name} OFF command 1`, '1'), press(endpoint.off2, `${endpoint.name} OFF command 2`, '1'), setState(ownVariable, 'idle', '1')],
      behavior: 'Flash when called. With or without an alert, first press runs configured ON commands; next press runs OFF commands and returns to listening.' }),
  ];
  if (JSON.stringify(endpoint.call) === JSON.stringify(endpoint.alarm)) throw new Error(`Com buttons overlap at ${endpoint.call.page}/${endpoint.call.row}/${endpoint.call.column}.`);
  return { endpointId: endpoint.id, stateVariable: `custom:${ownVariable}`, companionAddress, targetEndpoint: target, plans };
}

export const buildPeerIntercomPlans = buildComEndpointPlans;
export function comStateVariable(id) { return `ccb_com_${slug(id)}`; }

export function lv1ComMuteDefinition(channel, operation) {
  return {
    definitionId: 'mute',
    options: {
      group: 0, group_expr: '', ch_in: Number(channel), ch_in_expr: '',
      ch_grp: 1, ch_grp_expr: '', ch_aux: 1, ch_aux_expr: '',
      ch_mtx: 1, ch_mtx_expr: '', ch_dca: 1, ch_dca_expr: '', ch_expr: '',
      state: operation === 'unmute' ? 'off' : 'on', state_expr: '',
    },
  };
}

export function parseComUpdateCommand(command, endpoints = [], connections = []) {
  const text = String(command || '').trim();
  if (!/^(?:(?:can|could|would)\s+(?:you|we)\s+|please\s+)?(?:change|update|edit|rename|set|connect|disconnect)\b/i.test(text)) return null;
  const explicitId = text.match(/\bCOM[-\s]?(\d{4,})\b/i)?.[1];
  const locationMatch = text.match(/\b(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)\b/);
  const location = locationMatch ? { page: Number(locationMatch[1]), row: Number(locationMatch[2]), column: Number(locationMatch[3]) } : null;
  const endpoint = location
    ? endpoints.find((item) => Object.values(item.buttons || {}).some((spot) => spot?.page === location.page && spot?.row === location.row && spot?.column === location.column))
    : explicitId ? endpoints.find((item) => item.id === `COM-${explicitId}`) : null;
  if (!endpoint) return null;

  const changes = {};
  const channel = text.match(/\b(?:channel|ch)\s*(?:#|number)?\s*(?:to|=|as)?\s*(\d+)\b/i)?.[1];
  const answerAction = text.match(/\banswer(?:\s+action)?\s*(?:to|=|as)?\s*(unmute|mute)\b/i)?.[1];
  const resetAction = text.match(/\breset(?:\s+action)?\s*(?:to|=|as)?\s*(unmute|mute)\b/i)?.[1];
  const targetId = text.match(/\bconnect(?:\s+(?:it|pair|endpoint))?\s+to\s+COM[-\s]?(\d{4,})\b/i)?.[1];
  if (channel) changes.channel = Number(channel);
  if (answerAction) changes.answerAction = answerAction.toLowerCase();
  if (resetAction) changes.resetAction = resetAction.toLowerCase();
  if (/\bdisconnect(?:\s+(?:it|pair|endpoint))?\b/i.test(text)) changes.targetEndpointId = '';
  else if (targetId) changes.targetEndpointId = `COM-${targetId}`;
  if (explicitId && /\b(?:rename|name)\b/i.test(text)) {
    const name = text.match(/\b(?:rename|name)(?:\s+(?:COM[-\s]?\d+|the\s+(?:Com\s+)?(?:pair|endpoint)))?\s+(?:to|as)\s+["“]?([^"”;,]+?)["”]?\s*$/i)?.[1]?.trim();
    if (name) changes.name = name;
  }
  if (/\b(?:module|connection)\b/i.test(text)) {
    const candidates = connections.filter((item) => {
      const labels = [item.label, item.moduleId].filter(Boolean).map((value) => String(value).toLowerCase());
      return labels.some((label) => text.toLowerCase().includes(label) || label.includes('lv1') && /\blv1\b/i.test(text));
    });
    if (candidates.length === 1) changes.connectionId = candidates[0].id;
    else if (candidates.length > 1) throw new Error('More than one active Com module connection matches that update. Name the exact connection label.');
    else throw new Error('No active Companion connection matches the requested Com module update.');
  }
  if (!Object.keys(changes).length) return null;
  return { endpoint, changes, sourceText: text };
}
