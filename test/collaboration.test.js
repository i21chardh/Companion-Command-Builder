import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinatorAddress, createCustodyRegistry } from '../src/collaboration.js';

test('surface custody is exclusive, renewable, and released by its owner', () => {
  let clock = 1000;
  const registry = createCustodyRegistry({ ttlMs: 100, now: () => clock });
  registry.announce({ ownerId: 'client-a', ownerName: 'Monitor A', surfaceIds: ['streamdeck:one'] });
  assert.equal(registry.acquire({ ownerId: 'client-a', ownerName: 'Monitor A', surfaceId: 'streamdeck:one' }).acquired, true);
  const conflict = registry.acquire({ ownerId: 'client-b', ownerName: 'Monitor B', surfaceId: 'streamdeck:one' });
  assert.equal(conflict.acquired, false);
  assert.equal(conflict.conflict.ownerName, 'Monitor A');
  clock = 1050;
  registry.heartbeat({ ownerId: 'client-a', ownerName: 'Monitor A' });
  clock = 1120;
  assert.equal(registry.snapshot().leases.length, 1);
  assert.deepEqual(registry.release({ ownerId: 'client-a', ownerName: 'Monitor A', surfaceId: 'streamdeck:one' }).released, ['streamdeck:one']);
  assert.equal(registry.acquire({ ownerId: 'client-b', ownerName: 'Monitor B', surfaceId: 'streamdeck:one' }).acquired, true);
});

test('expired clients release custody and disappear from shared surface presence', () => {
  let clock = 0;
  const registry = createCustodyRegistry({ ttlMs: 50, now: () => clock });
  registry.announce({ ownerId: 'client-a', ownerName: 'A', surfaceIds: ['streamdeck:one', 'streamdeck:two'] });
  registry.acquire({ ownerId: 'client-a', ownerName: 'A', surfaceId: 'streamdeck:one' });
  assert.deepEqual(registry.snapshot().onlineSurfaceIds, ['streamdeck:one', 'streamdeck:two']);
  clock = 51;
  assert.deepEqual(registry.snapshot(), { available: true, ttlMs: 50, leases: [], onlineSurfaceIds: [], surfaces: [], clients: [] });
});

test('shared inventory includes complete sanitized surface descriptors for remote CCB clients', () => {
  const registry = createCustodyRegistry();
  const surface = { id: 'streamdeck:one', name: 'Monitor Deck', type: 'Elgato Stream Deck +', columns: 4, rows: 2, xOffset: 5, yOffset: 1, connected: true };
  registry.announce({ ownerId: 'central-server', ownerName: 'Central inventory', inventory: true, surfaceIds: [surface.id], surfaces: [surface] });
  registry.announce({ ownerId: 'remote-client', ownerName: 'Remote', surfaceIds: [], surfaces: [] });
  const snapshot = registry.snapshot();
  assert.equal(snapshot.clients.length, 1);
  assert.deepEqual(snapshot.onlineSurfaceIds, ['streamdeck:one']);
  assert.deepEqual(snapshot.surfaces[0], { ...surface, rotation: 0, enabled: true, satellite: false, companionXOffset: 5, companionYOffset: 1 });
});

test('remote Satellite presence makes central inventory selectable without hiding direct surfaces', () => {
  const registry = createCustodyRegistry();
  const direct = { id: 'streamdeck:direct', name: 'Local Deck', type: 'Stream Deck +', columns: 4, rows: 4, connected: true };
  const satellite = { id: 'streamdeck:remote', name: 'Remote Deck', type: 'Stream Deck', columns: 5, rows: 3, connected: false, satellite: true };
  registry.announce({ ownerId: 'central-server', ownerName: 'Central inventory', inventory: true, surfaceIds: [direct.id], surfaces: [direct, satellite] });
  registry.announce({ ownerId: 'remote-client', ownerName: 'Remote CCB', surfaceIds: [satellite.id], surfaces: [direct, satellite] });
  const snapshot = registry.snapshot();
  assert.deepEqual(new Set(snapshot.onlineSurfaceIds), new Set([direct.id, satellite.id]));
  assert.equal(snapshot.surfaces.find((surface) => surface.id === direct.id)?.connected, true);
  assert.equal(snapshot.surfaces.find((surface) => surface.id === satellite.id)?.connected, true);
  assert.equal(registry.acquire({ ownerId: 'remote-client', ownerName: 'Remote CCB', surfaceId: satellite.id }).acquired, true);
  registry.release({ ownerId: 'remote-client', ownerName: 'Remote CCB', surfaceId: satellite.id });
  assert.equal(registry.acquire({ ownerId: 'other-client', ownerName: 'Other CCB', surfaceId: satellite.id }).acquired, true);
});

test('heartbeat reconciles stale leases to the owners current checked-surface list', () => {
  const registry = createCustodyRegistry();
  registry.announce({ ownerId: 'client-a', ownerName: 'A', surfaceIds: ['streamdeck:one', 'streamdeck:two'] });
  registry.acquire({ ownerId: 'client-a', ownerName: 'A', surfaceId: 'streamdeck:one' });
  registry.acquire({ ownerId: 'client-a', ownerName: 'A', surfaceId: 'streamdeck:two' });
  assert.equal(registry.snapshot().leases.length, 2);
  registry.heartbeat({ ownerId: 'client-a', ownerName: 'A', surfaceIds: ['streamdeck:two'] });
  assert.deepEqual(registry.snapshot().leases.map((lease) => lease.surfaceId), ['streamdeck:two']);
  registry.heartbeat({ ownerId: 'client-a', ownerName: 'A', surfaceIds: [] });
  assert.deepEqual(registry.snapshot().leases, []);
  assert.equal(registry.acquire({ ownerId: 'client-b', ownerName: 'B', surfaceId: 'streamdeck:one' }).acquired, true);
  assert.equal(registry.acquire({ ownerId: 'client-b', ownerName: 'B', surfaceId: 'streamdeck:two' }).acquired, true);
});

test('coordinator follows the Companion host while using the dedicated custody port', () => {
  assert.equal(coordinatorAddress('169.254.54.113:8000'), 'http://169.254.54.113:3110');
  assert.equal(coordinatorAddress('localhost:8000'), 'http://localhost:3110');
  assert.equal(coordinatorAddress('[fe80::1]:8000'), 'http://[fe80::1]:3110');
});
