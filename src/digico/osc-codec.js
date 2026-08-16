function oscString(value) {
  const raw = Buffer.from(`${value}\0`, 'utf8');
  return Buffer.concat([raw, Buffer.alloc((4 - (raw.length % 4)) % 4)]);
}

export function encodeOscMessage(path, args = []) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('OSC path must start with /.');
  const tags = [','];
  const payload = [];
  for (const value of args) {
    if (typeof value === 'boolean') tags.push(value ? 'T' : 'F');
    else if (Number.isInteger(value)) {
      tags.push('i'); const buffer = Buffer.alloc(4); buffer.writeInt32BE(value); payload.push(buffer);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      tags.push('f'); const buffer = Buffer.alloc(4); buffer.writeFloatBE(value); payload.push(buffer);
    } else if (typeof value === 'string') { tags.push('s'); payload.push(oscString(value)); }
    else throw new Error(`Unsupported OSC argument: ${String(value)}`);
  }
  return Buffer.concat([oscString(path), oscString(tags.join('')), ...payload]);
}

export function encodeFloatBoolean(path, enabled) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('OSC path must start with /.');
  const value = Buffer.alloc(4);
  value.writeFloatBE(enabled ? 1 : 0);
  return Buffer.concat([oscString(path), oscString(',f'), value]);
}
