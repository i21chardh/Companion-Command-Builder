'use strict';

// Verified on LV1: /Get/Sends i:aux replies with /Notify/Sends
// [aux, count, (group, channel, gain dB) × count]. All indices are zero based.
function parseSendState(message) {
  if (message?.address !== '/Notify/Sends') return null;
  const args = message.args;
  const integer = arg => arg?.type === 'i' && Number.isInteger(arg.value) && arg.value >= 0;
  if (!Array.isArray(args) || !integer(args[0]) || !integer(args[1])) return null;
  const count = args[1].value;
  if (count < 1 || count > 2048 || args.length !== 2 + count * 3) return null;
  const entries = [];
  for (let index = 2; index < args.length; index += 3) {
    const [group, channel, gain] = args.slice(index, index + 3);
    if (!integer(group) || !integer(channel) || !['i', 'f', 'd'].includes(gain?.type)
      || !Number.isFinite(gain.value) || gain.value < -144 || gain.value > 10) return null;
    entries.push({ group: group.value, channel: channel.value, aux: args[0].value, gain: gain.value });
  }
  return entries;
}

function installSendState(LV1Instance) {
  const originalNotify = LV1Instance.prototype.handleNotify;
  LV1Instance.prototype.handleNotify = function (message) {
    const entries = parseSendState(message);
    if (entries) {
      for (const { group, channel, aux, gain } of entries) {
        const key = `${group}.${channel}.${aux}`;
        this.sends.set(key, { ...(this.sends.get(key) || { on: false }), gain });
        this.knownSendGains.add(key);
      }
      this.scheduleRelativeStateCacheSave();
      return;
    }
    return originalNotify.call(this, message);
  };

  LV1Instance.prototype.adjustRelativeSend = function (channel, aux, delta) {
    const osc = this.osc;
    if (![channel, aux].every(value => Number.isInteger(value) && value >= 0) || !Number.isFinite(delta)) return Promise.resolve(false);
    const operation = (this.ccbSendQueue || Promise.resolve()).then(async () => {
      if (!osc?.isConnected() || this.osc !== osc) return false;
      const gain = await new Promise(resolve => {
        let timer;
        const finish = value => {
          clearTimeout(timer);
          osc.off('packet', onPacket);
          osc.off('close', onClose);
          resolve(value);
        };
        const onClose = () => finish(null);
        const onPacket = ({ decoded }) => {
          const entries = parseSendState(decoded);
          const target = entries?.find(entry => entry.group === 0 && entry.channel === channel && entry.aux === aux);
          if (target) finish(target.gain);
        };
        osc.on('packet', onPacket);
        osc.on('close', onClose);
        timer = setTimeout(() => finish(null), 1000);
        try { osc.send('/Get/Sends', [{ type: 'i', value: aux }]); }
        catch { finish(null); }
      });
      if (gain == null || !osc.isConnected() || this.osc !== osc) {
        this.log('warn', `Relative send: no fresh LV1 reply for channel ${channel + 1}, aux ${aux + 1}; adjustment skipped`);
        return false;
      }
      const next = Math.max(-144, Math.min(10, gain + delta));
      this.applySendDelta(0, channel, aux, { gain: next });
      this.send('/Set/Aux/Send/Gain', [
        { type: 'i', value: 0 }, { type: 'i', value: channel },
        { type: 'i', value: aux }, { type: 'd', value: next },
      ]);
      return true;
    });
    this.ccbSendQueue = operation.catch(() => false);
    return operation;
  };
}

module.exports = installSendState;
module.exports.parseSendState = parseSendState;
