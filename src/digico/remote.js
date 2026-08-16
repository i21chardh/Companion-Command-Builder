import dgram from 'node:dgram';
import { capabilityTrace, digicoCapability, renderCapabilityPath } from './capabilities.js';
import { encodeFloatBoolean, encodeOscMessage } from './osc-codec.js';

const MAX_LOG = 250;

export class DigicoRemote {
  constructor({ host, sendPort = 8000, receivePort = 9000, consoleFamily = 'quantum', quantumWriteVerified = false, rawCapture = false } = {}) {
    if (!host) throw new Error('A DiGiCo console host is required.');
    this.config = { host, sendPort, receivePort, consoleFamily, quantumWriteVerified, rawCapture };
    this.socket = null;
    this.log = [];
    this.state = new Map();
  }

  diagnostic(event) {
    this.log.unshift({ at: new Date().toISOString(), ...event });
    this.log.length = Math.min(this.log.length, MAX_LOG);
  }

  async open() {
    if (this.socket) return this.status();
    const socket = dgram.createSocket('udp4');
    await new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(this.config.receivePort, '0.0.0.0', () => { socket.off('error', reject); resolve(); });
    });
    socket.on('message', (packet, remote) => this.diagnostic({ direction: 'in', transport: 'digico-pad', bytes: packet.length, rawHex: this.config.rawCapture ? packet.toString('hex') : undefined, remote }));
    socket.on('error', (error) => this.diagnostic({ direction: 'error', message: error.message }));
    this.socket = socket;
    return this.status();
  }

  async close() {
    if (this.socket) await new Promise((resolve) => { const socket = this.socket; this.socket = null; socket.close(resolve); });
    return this.status();
  }

  status() {
    return { connected: Boolean(this.socket), config: { ...this.config }, diagnostics: [...this.log], state: Object.fromEntries(this.state) };
  }

  async sendPacket(path, packet, { kind, trace, dryRun = true } = {}) {
    const record = { direction: 'out', transport: 'digico-pad', kind, path, bytes: packet.length, rawHex: this.config.rawCapture ? packet.toString('hex') : undefined, dryRun, trace };
    this.diagnostic(record);
    if (dryRun) return record;
    if (!this.socket) await this.open();
    await new Promise((resolve, reject) => this.socket.send(packet, this.config.sendPort, this.config.host, (error) => error ? reject(error) : resolve()));
    return record;
  }

  async query(capabilityId, target, options = {}) {
    const definition = digicoCapability(capabilityId);
    if (!definition.readable) throw new Error(`${capabilityId} is not readable.`);
    const path = `${renderCapabilityPath(definition, target)}${definition.querySuffix || '/?'}`;
    return this.sendPacket(path, encodeOscMessage(path), { kind: 'query', dryRun: options.dryRun !== false, trace: capabilityTrace(capabilityId, target, false) });
  }

  async setBoolean(capabilityId, target, enabled, options = {}) {
    const definition = digicoCapability(capabilityId);
    if (!definition.writable || definition.valueType !== 'boolean') throw new Error(`${capabilityId} is not a writable boolean capability.`);
    const dryRun = options.dryRun !== false;
    if (!dryRun && this.config.consoleFamily === 'quantum' && !this.config.quantumWriteVerified) {
      throw new Error('Quantum Pad writes are locked until the Quantum 338 read-back probe verifies this console profile. Run the insert-state query and confirm matching feedback first.');
    }
    const path = renderCapabilityPath(definition, target);
    return this.sendPacket(path, encodeFloatBoolean(path, Boolean(enabled)), { kind: 'write', dryRun, trace: capabilityTrace(capabilityId, target, enabled) });
  }
}
