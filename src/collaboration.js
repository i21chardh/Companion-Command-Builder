const DEFAULT_LEASE_TTL_MS = 15000;

function cleanText(value, maximum = 96) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maximum);
}

function cleanSurfaceIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => cleanText(value, 160)).filter((value) => /^[a-z0-9:_-]+$/i.test(value)))].slice(0, 128);
}

export function createCustodyRegistry({ ttlMs = DEFAULT_LEASE_TTL_MS, now = () => Date.now() } = {}) {
  const leases = new Map();
  const presence = new Map();

  function purge() {
    const current = now();
    for (const [surfaceId, lease] of leases) if (lease.expiresAt <= current) leases.delete(surfaceId);
    for (const [ownerId, item] of presence) if (item.expiresAt <= current) presence.delete(ownerId);
  }

  function identity(input) {
    const ownerId = cleanText(input?.ownerId, 96);
    if (!/^[a-z0-9_-]{6,96}$/i.test(ownerId)) throw new Error('A valid CCB client identity is required.');
    return { ownerId, ownerName: cleanText(input?.ownerName, 80) || `CCB ${ownerId.slice(0, 6)}` };
  }

  function snapshot() {
    purge();
    const onlineSurfaceIds = [...new Set([...presence.values()].flatMap((item) => item.surfaceIds))];
    return {
      available: true,
      ttlMs,
      leases: [...leases.entries()].map(([surfaceId, lease]) => ({ surfaceId, ownerId: lease.ownerId, ownerName: lease.ownerName, expiresAt: lease.expiresAt })),
      onlineSurfaceIds,
      clients: [...presence.values()].map((item) => ({ ownerId: item.ownerId, ownerName: item.ownerName, surfaceCount: item.surfaceIds.length })),
    };
  }

  function announce(input) {
    purge();
    const owner = identity(input);
    presence.set(owner.ownerId, { ...owner, surfaceIds: cleanSurfaceIds(input?.surfaceIds), expiresAt: now() + ttlMs });
    return snapshot();
  }

  function acquire(input) {
    purge();
    const owner = identity(input);
    const surfaceId = cleanSurfaceIds([input?.surfaceId])[0];
    if (!surfaceId) throw new Error('A valid surface ID is required.');
    const existing = leases.get(surfaceId);
    if (existing && existing.ownerId !== owner.ownerId) return { acquired: false, conflict: { surfaceId, ownerId: existing.ownerId, ownerName: existing.ownerName }, ...snapshot() };
    leases.set(surfaceId, { ...owner, expiresAt: now() + ttlMs });
    return { acquired: true, ...snapshot() };
  }

  function heartbeat(input) {
    purge();
    const owner = identity(input);
    const expiresAt = now() + ttlMs;
    const desiredSurfaceIds = Array.isArray(input?.surfaceIds) ? new Set(cleanSurfaceIds(input.surfaceIds)) : null;
    for (const [surfaceId, lease] of leases) {
      if (lease.ownerId !== owner.ownerId) continue;
      if (desiredSurfaceIds && !desiredSurfaceIds.has(surfaceId)) leases.delete(surfaceId);
      else Object.assign(lease, owner, { expiresAt });
    }
    const existing = presence.get(owner.ownerId);
    if (existing) presence.set(owner.ownerId, { ...existing, ...owner, expiresAt });
    return snapshot();
  }

  function release(input) {
    purge();
    const owner = identity(input);
    const requested = input?.all ? [...leases.keys()] : cleanSurfaceIds(input?.surfaceIds || [input?.surfaceId]);
    const released = [];
    for (const surfaceId of requested) {
      if (leases.get(surfaceId)?.ownerId !== owner.ownerId) continue;
      leases.delete(surfaceId); released.push(surfaceId);
    }
    return { released, ...snapshot() };
  }

  return { acquire, announce, heartbeat, release, snapshot };
}

export function coordinatorAddress(companionAddress, port = 3110) {
  const raw = String(companionAddress || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(raw)) throw new Error('Invalid Companion address.');
  const url = new URL(`http://${raw}`);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  return `http://${hostname.includes(':') ? `[${hostname}]` : hostname}:${port}`;
}
