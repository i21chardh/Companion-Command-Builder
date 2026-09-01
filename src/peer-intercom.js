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
  return String(value || 'peer-intercom').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'peer_intercom';
}

export function normalizeComAddress(value) {
  const address = String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!/^[a-z0-9.-]+(?::\d{1,5})?$/i.test(address)) throw new Error('Peer IP address must be a host or IP address with an optional port.');
  return address;
}

function optionalComAddress(value) {
  return String(value || '').trim() ? normalizeComAddress(value) : '';
}

function press(location, name, step = '0') {
  return location ? { connectionId: 'internal', definitionId: 'button_pressrelease', name, step, options: { location: `${location.page}/${location.row}/${location.column}`, force: true } } : null;
}

function setState(variable, value, step = '0') {
  return { connectionId: 'internal', definitionId: 'custom_variable_set_value', name: `Set intercom state to ${value}`, step, options: { name: variable, create: true, value } };
}

function plan({ location, surfaceId, text, color, definitions, variable, feedbacks, behavior, role, workflowId }) {
  return {
    kind: 'create-button', schemaVersion: 1,
    target: { product: 'Bitfocus Companion', version: '5.0.3' },
    module: { id: 'internal', version: '5.0.3', name: 'Companion Internal' },
    safety: { overwriteExisting: false, requireConfirmation: true },
    targetSurfaceId: surfaceId,
    intercom: { workflowId, role, stateVariable: variable },
    button: {
      location, text,
      appearance: { textColor: '#ffffff', backgroundColor: color },
      action: { family: 'peer-intercom', operation: role, definitions: definitions.filter(Boolean) },
      feedback: { family: 'peer-intercom-state', variable: `custom:${variable}`, states: feedbacks },
      behavior,
    },
    deployment: { status: 'ready', reason: 'Uses validated Companion 5.0.3 internal custom-variable, button-trigger, and variable-feedback definitions.' },
  };
}

function peerInput(input, key) {
  const peer = input[key] || {};
  const name = String(peer.name || (key === 'peerA' ? 'Peer A' : 'Peer B')).trim();
  if (!peer.surfaceId) throw new Error(`${name} requires a workspace surface.`);
  return {
    name, surfaceId: String(peer.surfaceId),
    call: parseIntercomLocation(peer.call, `${name} Call position`),
    alarm: parseIntercomLocation(peer.alarm || peer.answer, `${name} Alarm position`),
    talkOn: parseIntercomLocation(peer.talkOn, `${name} talk-path ON control`, { optional: true }),
    talkOff: parseIntercomLocation(peer.talkOff, `${name} talk-path OFF control`, { optional: true }),
    listenOn: parseIntercomLocation(peer.listenOn, `${name} listen-path ON control`, { optional: true }),
    listenOff: parseIntercomLocation(peer.listenOff, `${name} listen-path OFF control`, { optional: true }),
  };
}

export function buildPeerIntercomPlans(input = {}) {
  // Network commissioning is optional while the operator builds a layout.
  const peerAddress = optionalComAddress(input.peerAddress);
  const a = peerInput(input, 'peerA');
  const b = peerInput(input, 'peerB');
  const workflowId = slug(input.name || `${a.name}-${b.name}`);
  const variable = `ccb_intercom_${workflowId}`;
  const aCalling = 'a_calling_b';
  const bCalling = 'b_calling_a';
  const connected = 'connected';
  const idle = 'idle';
  const plans = [
    plan({ location: a.call, surfaceId: a.surfaceId, text: `CALL\n${b.name}`, color: '#174b7a', variable, feedbacks: [{ values: [aCalling, connected], backgroundColor: '#0066cc' }], role: 'call-peer-b', workflowId,
      definitions: [setState(variable, aCalling)], behavior: `Call ${b.name} and raise its flashing alarm.` }),
    plan({ location: a.alarm, surfaceId: a.surfaceId, text: `ALARM\n${b.name}`, color: '#351217', variable, feedbacks: [{ values: [bCalling], backgroundColor: '#ff0000', flash: true }, { values: [connected], backgroundColor: '#008000' }], role: 'alarm-peer-b', workflowId,
      definitions: [setState(variable, connected, '0'), press(a.talkOn, `${a.name} talk path ON`, '0'), press(a.listenOn, `${a.name} listen path ON`, '0'), press(a.talkOff, `${a.name} talk path OFF`, '1'), press(a.listenOff, `${a.name} listen path OFF`, '1'), setState(variable, idle, '1')], behavior: `Flash when called by ${b.name}. With or without an alert, first press opens configured paths; next press resets paths and returns to listening.` }),
    plan({ location: b.call, surfaceId: b.surfaceId, text: `CALL\n${a.name}`, color: '#174b7a', variable, feedbacks: [{ values: [bCalling, connected], backgroundColor: '#0066cc' }], role: 'call-peer-a', workflowId,
      definitions: [setState(variable, bCalling)], behavior: `Call ${a.name} and raise its flashing alarm.` }),
    plan({ location: b.alarm, surfaceId: b.surfaceId, text: `ALARM\n${a.name}`, color: '#351217', variable, feedbacks: [{ values: [aCalling], backgroundColor: '#ff0000', flash: true }, { values: [connected], backgroundColor: '#008000' }], role: 'alarm-peer-a', workflowId,
      definitions: [setState(variable, connected, '0'), press(b.talkOn, `${b.name} talk path ON`, '0'), press(b.listenOn, `${b.name} listen path ON`, '0'), press(b.talkOff, `${b.name} talk path OFF`, '1'), press(b.listenOff, `${b.name} listen path OFF`, '1'), setState(variable, idle, '1')], behavior: `Flash when called by ${a.name}. With or without an alert, first press opens configured paths; next press resets paths and returns to listening.` }),
  ];
  const duplicate = plans.find((candidate, index) => plans.some((other, otherIndex) => otherIndex !== index && other.targetSurfaceId === candidate.targetSurfaceId && JSON.stringify(other.button.location) === JSON.stringify(candidate.button.location)));
  if (duplicate) throw new Error(`Intercom buttons overlap at ${duplicate.button.location.page}/${duplicate.button.location.row}/${duplicate.button.location.column}.`);
  for (const item of plans) item.intercom.peerAddress = peerAddress;
  if (!peerAddress) for (const item of plans) {
    item.intercom.configurationPending = true;
    item.deployment.reason = 'Com layout is ready; peer network relay configuration is pending.';
  }
  return { workflowId, stateVariable: `custom:${variable}`, peerAddress, plans };
}

export function comStateVariable(name) { return `ccb_intercom_${slug(name)}`; }
