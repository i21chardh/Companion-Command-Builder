import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import installSendState, { parseSendState } from '../integrations/waves-lv1-ccb/send-state.cjs';

const i = value => ({ type: 'i', value });
const reply = (gain = -10) => ({ address: '/Notify/Sends', args: [i(23), i(2), i(0), i(43), { type: 'd', value: -144 }, i(0), i(44), { type: 'd', value: gain }] });
function instance({ gain = -10, missing = false } = {}) {
  class LV1 {
    constructor() { this.sends = new Map(); this.knownSendGains = new Set(); this.writes = []; }
    handleNotify() {}
    scheduleRelativeStateCacheSave() {}
    applySendDelta(group, channel, aux, delta) { this.sends.set(`${group}.${channel}.${aux}`, delta); }
    send(address, args) { this.writes.push({ address, args }); gain = args[3].value; }
    log() {}
  }
  installSendState(LV1);
  const self = new LV1();
  self.osc = new EventEmitter();
  self.osc.isConnected = () => true;
  self.osc.send = (address, args) => {
    assert.equal(address, '/Get/Sends');
    assert.deepEqual(args, [i(23)]);
    if (missing) return queueMicrotask(() => self.osc.emit('close'));
    queueMicrotask(() => {
      const decoded = reply(gain);
      self.handleNotify(decoded);
      self.osc.emit('packet', { decoded });
    });
  };
  return self;
}
test('LV1 bulk send reply populates actual channel 45 monitor 16 state', () => {
  assert.deepEqual(parseSendState(reply())[1], { group: 0, channel: 44, aux: 23, gain: -10 });
  const self = instance(); self.handleNotify(reply());
  assert.equal(self.sends.get('0.44.23').gain, -10);
  assert.equal(self.knownSendGains.has('0.44.23'), true);
  assert.equal(parseSendState({ ...reply(), args: reply().args.slice(0, -1) }), null);
  assert.equal(parseSendState(reply(NaN)), null);
});
test('LV1 encoder queries fresh levels after restart and serializes successive turns', async () => {
  const self = instance();
  self.sends.set('0.44.23', { gain: 8 }); // Stale cache must never set the starting level.
  assert.deepEqual(await Promise.all([self.adjustRelativeSend(44, 23, -1), self.adjustRelativeSend(44, 23, -1)]), [true, true]);
  assert.deepEqual(self.writes.map(write => write.args[3].value), [-11, -12]);
  assert.equal(self.osc.listenerCount('packet'), 0);
});
test('LV1 encoder skips missing fresh state and clamps real feedback', async () => {
  const missing = instance({ missing: true });
  assert.equal(await missing.adjustRelativeSend(44, 23, 1), false);
  assert.equal(missing.writes.length, 0);
  const self = instance({ gain: 10 });
  await self.adjustRelativeSend(44, 23, 1);
  assert.equal(self.writes[0].args[3].value, 10);
});
