import test from 'node:test';
import assert from 'node:assert/strict';
import { capabilityTrace, renderCapabilityPath } from '../src/digico/capabilities.js';
import { encodeFloatBoolean, encodeOscMessage } from '../src/digico/osc-codec.js';
import { decodePacket } from '../src/osc-test-receiver.js';
import { DigicoRemote } from '../src/digico/remote.js';

test('renders the traced Insert A and B Pad paths', () => {
  assert.equal(renderCapabilityPath('channel.insertA.enabled', { channel: 17 }), '/Input_Channels/17/Insert/insert_A_in');
  assert.equal(renderCapabilityPath('channel.insertB.enabled', { channel: 36 }), '/Input_Channels/36/Insert/insert_B_in');
  assert.equal(capabilityTrace('channel.insertA.enabled', { channel: 17 }, true).feedback.queryPath, '/Input_Channels/17/Insert/insert_A_in/?');
});

test('encodes Pad booleans as OSC float 1.0 and 0.0', () => {
  const remote = { address: '127.0.0.1', port: 8000 };
  const on = decodePacket(encodeFloatBoolean('/Input_Channels/1/Insert/insert_A_in', true), remote)[0];
  const off = decodePacket(encodeFloatBoolean('/Input_Channels/1/Insert/insert_B_in', false), remote)[0];
  assert.deepEqual([on.typeTags, on.args], [',f', [1]]);
  assert.deepEqual([off.typeTags, off.args], [',f', [0]]);
  assert.equal(decodePacket(encodeOscMessage('/Input_Channels/1/Insert/insert_A_in/?'), remote)[0].typeTags, ',');
});

test('Quantum writes are dry-run by default and locked until hardware verification', async () => {
  const client = new DigicoRemote({ host: '192.0.2.1' });
  const dryRun = await client.setBoolean('channel.insertA.enabled', { channel: 1 }, true);
  assert.equal(dryRun.dryRun, true);
  await assert.rejects(() => client.setBoolean('channel.insertA.enabled', { channel: 1 }, true, { dryRun: false }), /read-back probe/);
});
