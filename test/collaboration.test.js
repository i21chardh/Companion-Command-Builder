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
  assert.deepEqual(registry.snapshot(), { available: true, ttlMs: 50, leases: [], onlineSurfaceIds: [], clients: [] });
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
