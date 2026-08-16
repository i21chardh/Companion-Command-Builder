const capability = (definition) => Object.freeze({
  readable: false,
  writable: false,
  verification: 'documented',
  ...definition,
});

export const DIGICO_CAPABILITIES = Object.freeze([
  capability({ id: 'channel.mute', scope: 'inputChannel', transport: 'gp-osc', path: '/channel/{channel}/mute', namespaceVariants: ['', '/sd'], valueType: 'boolean', readable: true, writable: true, verification: 'documented' }),
  capability({ id: 'channel.eq.enabled', scope: 'inputChannel', transport: 'gp-osc', path: '/channel/{channel}/eq/enabled', namespaceVariants: ['', '/sd'], valueType: 'boolean', readable: true, writable: true, verification: 'documented' }),
  capability({ id: 'channel.insertA.enabled', scope: 'inputChannel', transport: 'digico-pad', path: '/Input_Channels/{channel}/Insert/insert_A_in', querySuffix: '/?', valueType: 'boolean', wireType: 'float01', readable: true, writable: true, verification: 's21-verified-quantum-assumed' }),
  capability({ id: 'channel.insertB.enabled', scope: 'inputChannel', transport: 'digico-pad', path: '/Input_Channels/{channel}/Insert/insert_B_in', querySuffix: '/?', valueType: 'boolean', wireType: 'float01', readable: true, writable: true, verification: 's21-verified-quantum-assumed' }),
]);

const BY_ID = new Map(DIGICO_CAPABILITIES.map((item) => [item.id, item]));

export function digicoCapability(id) {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown DiGiCo capability: ${id}`);
  return found;
}

export function renderCapabilityPath(definitionOrId, { channel } = {}) {
  const definition = typeof definitionOrId === 'string' ? digicoCapability(definitionOrId) : definitionOrId;
  if (definition.scope === 'inputChannel' && (!Number.isInteger(channel) || channel < 1 || channel > 144)) {
    throw new Error('DiGiCo input channel must be an integer from 1 through 144.');
  }
  return definition.path.replace('{channel}', String(channel));
}

export function capabilityTrace(id, target, value) {
  const definition = digicoCapability(id);
  const path = renderCapabilityPath(definition, target);
  return {
    logicalCommand: `digico.channel(${target.channel}).${id.endsWith('insertA.enabled') ? 'insertA' : id.endsWith('insertB.enabled') ? 'insertB' : id}.setEnabled(${Boolean(value)})`,
    transport: definition.transport,
    path,
    encoding: definition.wireType === 'float01' ? { oscType: 'float32', value: value ? 1.0 : 0.0 } : { value },
    feedback: definition.readable ? { queryPath: `${path}${definition.querySuffix || '/?'}`, statePath: path, acceptedBooleanEncodings: ['float01', 'int01', 'OSC true/false'] } : null,
    verification: definition.verification,
  };
}
