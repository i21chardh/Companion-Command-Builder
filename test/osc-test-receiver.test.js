import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { clearOscReceiverEvents, decodePacket, oscReceiverStatus, startOscReceiver, stopOscReceiver } from '../src/osc-test-receiver.js';

function oscString(value) { const raw = Buffer.from(`${value}\0`); return Buffer.concat([raw, Buffer.alloc((4 - raw.length % 4) % 4)]); }

test('decodes OSC address and common argument types', () => {
  const packet = Buffer.concat([oscString('/Input_Channels/1/mute'), oscString(',ifs'), Buffer.from([0,0,0,1]), Buffer.from([0x3f,0,0,0]), oscString('on')]);
  const [event] = decodePacket(packet, { address: '127.0.0.1', port: 1234 });
  assert.equal(event.address, '/Input_Channels/1/mute');
  assert.deepEqual(event.args, [1, 0.5, 'on']);
  assert.equal(event.remotePort, 1234);
});

test('receives a real UDP OSC packet and can rebind to another port', async (context) => {
  context.after(() => stopOscReceiver());
  const base = 42000 + Math.floor(Math.random() * 10000);
  try { await startOscReceiver(base); }
  catch (error) { if (/bind EPERM/.test(error.message)) return context.skip('UDP sockets are blocked by this test sandbox.'); throw error; }
  const sender = dgram.createSocket('udp4');
  context.after(() => sender.close());
  const packet = Buffer.concat([oscString('/ccb/receiver/test'), oscString(',i'), Buffer.from([0, 0, 0, 7])]);
  await new Promise((resolve, reject) => sender.send(packet, base, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(oscReceiverStatus().events[0].address, '/ccb/receiver/test');
  clearOscReceiverEvents();
  await startOscReceiver(base + 1);
  assert.equal(oscReceiverStatus().port, base + 1);
  assert.equal(oscReceiverStatus().listening, true);
});
