import dgram from 'node:dgram';

const MAX_EVENTS = 200;
let socket = null;
let state = { listening: false, port: 9000, host: '0.0.0.0', startedAt: null, error: null, events: [] };

function paddedEnd(buffer, offset) {
  const zero = buffer.indexOf(0, offset);
  if (zero < 0) throw new Error('OSC string is not terminated.');
  return { value: buffer.toString('utf8', offset, zero), next: Math.ceil((zero + 1) / 4) * 4 };
}

function decodeMessage(buffer, remote, receivedAt = new Date().toISOString()) {
  const address = paddedEnd(buffer, 0);
  if (!address.value.startsWith('/')) throw new Error('Packet is not an OSC message.');
  const tags = paddedEnd(buffer, address.next);
  if (!tags.value.startsWith(',')) throw new Error('OSC type tag is missing.');
  let offset = tags.next;
  const args = [];
  for (const tag of tags.value.slice(1)) {
    if (tag === 'i') { args.push(buffer.readInt32BE(offset)); offset += 4; }
    else if (tag === 'f') { args.push(Number(buffer.readFloatBE(offset).toFixed(6))); offset += 4; }
    else if (tag === 's') { const item = paddedEnd(buffer, offset); args.push(item.value); offset = item.next; }
    else if (tag === 'T') args.push(true);
    else if (tag === 'F') args.push(false);
    else if (tag === 'N') args.push(null);
    else if (tag === 'b') { const length = buffer.readInt32BE(offset); offset += 4; args.push({ blobBytes: length }); offset = Math.ceil((offset + length) / 4) * 4; }
    else { args.push({ unsupportedType: tag }); break; }
  }
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, receivedAt, address: address.value, typeTags: tags.value, args, bytes: buffer.length, remoteAddress: remote.address, remotePort: remote.port };
}

function decodePacket(buffer, remote) {
  if (buffer.subarray(0, 8).toString() !== '#bundle\0') return [decodeMessage(buffer, remote)];
  const receivedAt = new Date().toISOString();
  const messages = [];
  let offset = 16;
  while (offset + 4 <= buffer.length) {
    const length = buffer.readInt32BE(offset); offset += 4;
    if (length < 1 || offset + length > buffer.length) break;
    messages.push(...decodePacket(buffer.subarray(offset, offset + length), remote).map((event) => ({ ...event, receivedAt, bundled: true })));
    offset += length;
  }
  return messages;
}

function oscString(value) {
  const raw = Buffer.from(`${value}\0`, 'utf8');
  return Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4)]);
}

export function oscReceiverStatus() { return { ...state, events: [...state.events] }; }

export async function startOscReceiver(port = 9000) {
  const requestedPort = Number(port);
  if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65535) throw new Error('OSC test port must be from 1024 through 65535.');
  if (socket && state.port === requestedPort) return oscReceiverStatus();
  if (socket) await stopOscReceiver();
  const next = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    const fail = (error) => { next.close(); reject(new Error(`UDP ${requestedPort} could not be opened: ${error.message}`)); };
    next.once('error', fail);
    next.bind(requestedPort, '0.0.0.0', () => { next.off('error', fail); resolve(); });
  });
  socket = next;
  state = { ...state, listening: true, port: requestedPort, startedAt: new Date().toISOString(), error: null };
  next.on('message', (buffer, remote) => {
    try { state.events = [...decodePacket(buffer, remote), ...state.events].slice(0, MAX_EVENTS); }
    catch (error) { state.events = [{ id: `${Date.now()}-error`, receivedAt: new Date().toISOString(), error: error.message, bytes: buffer.length, remoteAddress: remote.address, remotePort: remote.port }, ...state.events].slice(0, MAX_EVENTS); }
  });
  next.on('error', (error) => { state.error = error.message; });
  return oscReceiverStatus();
}

export async function stopOscReceiver() {
  if (socket) await new Promise((resolve) => { const closing = socket; socket = null; closing.close(() => resolve()); });
  state = { ...state, listening: false, startedAt: null };
  return oscReceiverStatus();
}

export function clearOscReceiverEvents() { state.events = []; return oscReceiverStatus(); }
export async function selfTestOscReceiver(port = state.port) {
  const targetPort = Number(port);
  if (!socket || state.port !== targetPort) await startOscReceiver(targetPort);
  const before = state.events.length;
  const sender = dgram.createSocket('udp4');
  const packet = Buffer.concat([oscString('/ccb/receiver/self-test'), oscString(',s'), oscString('ok')]);
  try {
    await new Promise((resolve, reject) => sender.send(packet, targetPort, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  } finally { sender.close(); }
  const deadline = Date.now() + 750;
  while (Date.now() < deadline && state.events.length === before) await new Promise((resolve) => setTimeout(resolve, 15));
  if (!state.events.some((event) => event.address === '/ccb/receiver/self-test')) throw new Error(`No loopback OSC packet arrived on UDP ${targetPort}.`);
  return oscReceiverStatus();
}
export { decodePacket };
