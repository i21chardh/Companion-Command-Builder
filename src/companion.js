function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]).finally(() => clearTimeout(timer));
}

const satellitePresence = new Map();
const SATELLITE_PRESENCE_TTL_MS = 12000;

export function satelliteSurfaceBaseId(id) {
  return String(id || '').replace(/-dev\d+$/i, '');
}

export function reconcileSatelliteSurfaces(surfaces, status, remoteSurfaces, satelliteAddress) {
  if (!status?.connected || !Array.isArray(remoteSurfaces)) return surfaces;
  const present = new Map(remoteSurfaces.map((surface) => [satelliteSurfaceBaseId(surface?.surfaceId), surface]));
  return surfaces.map((surface) => {
    const remote = surface?.satellite ? present.get(satelliteSurfaceBaseId(surface.id)) : null;
    if (!remote) return surface;
    return { ...surface, connected: true, location: satelliteAddress || surface.location, satelliteRuntimeId: remote.surfaceId };
  });
}

function normalizedSatelliteAddress(address) {
  const raw = String(address || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!raw) return null;
  if (!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(raw)) throw new Error('Invalid Satellite address.');
  return /:\d+$/.test(raw) ? raw : `${raw}:9999`;
}

async function probeSatellite(address) {
  const target = normalizedSatelliteAddress(address);
  if (!target) return null;
  const options = { signal: AbortSignal.timeout(2500) };
  const [statusResponse, surfacesResponse] = await Promise.all([
    fetch(`http://${target}/api/status`, options),
    fetch(`http://${target}/api/surfaces`, options),
  ]);
  if (!statusResponse.ok || !surfacesResponse.ok) throw new Error('Satellite status API is unavailable.');
  return { address: target.replace(/:9999$/, ''), status: await statusResponse.json(), surfaces: await surfacesResponse.json() };
}

function applyCachedSatellitePresence(address, surfaces) {
  const cached = satellitePresence.get(String(address || ''));
  if (!cached || Date.now() - cached.checkedAt > SATELLITE_PRESENCE_TTL_MS) return surfaces;
  return reconcileSatelliteSurfaces(surfaces, cached.status, cached.surfaces, cached.address);
}

function trpcData(value) {
  return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'json') ? value.json : value;
}

export class CompanionRpcClient {
  constructor(address, { timeoutMs = 5000 } = {}) {
    this.url = `ws://${address.replace(/^https?:\/\//, '').replace(/\/$/, '')}/trpc`;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
  }
  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', (event) => this.#message(event.data));
    await withTimeout(new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', () => reject(new Error('Companion configuration channel is unavailable.')), { once: true });
    }), this.timeoutMs, 'Timed out connecting to Companion.');
  }
  close() { this.socket?.close(); }
  request(method, path, input, onData) {
    const id = this.nextId++;
    const promise = withTimeout(new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject, onData });
      this.socket.send(JSON.stringify({ id, method, params: { input, path } }));
    }), this.timeoutMs, `Companion did not answer ${path}.`).finally(() => { if (method !== 'subscription') this.pending.delete(id); });
    return { id, promise };
  }
  mutate(path, input) { return this.request('mutation', path, input).promise; }
  query(path, input) { return this.request('query', path, input).promise; }
  subscribe(path, input, onData) {
    const request = this.request('subscription', path, input, onData);
    return { id: request.id, started: request.promise, stop: () => this.socket.send(JSON.stringify({ id: request.id, method: 'subscription.stop' })) };
  }
  #message(raw) {
    if (raw === 'PING') return this.socket.send('PONG');
    const decoded = JSON.parse(raw);
    for (const message of Array.isArray(decoded) ? decoded : [decoded]) {
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      if (message.error) { pending.reject(new Error(message.error.message || 'Companion rejected the request.')); this.pending.delete(message.id); continue; }
      const result = message.result;
      if (pending.method === 'subscription') {
        if (result?.type === 'data') pending.onData?.(trpcData(result.data));
        if (result?.type === 'started') pending.resolve(true);
        if (result?.type === 'stopped') this.pending.delete(message.id);
      } else { pending.resolve(trpcData(result?.data)); this.pending.delete(message.id); }
    }
  }
}

// Companion's native page/row/column IDs are authoritative in connected mode.
// CCB intentionally performs no hidden coordinate translation here.
export function companionLocation(location) { return { pageNumber: location.page, row: location.row, column: location.column }; }

export function ccbGlobalLocation(location) {
  return { page: Number(location.page ?? location.pageNumber), row: Number(location.row), column: Number(location.column) };
}

export function ccbSurface(surface) {
  return { ...surface, companionXOffset: surface.xOffset, companionYOffset: surface.yOffset };
}

// CCB exposes every surface as PAGE/ROW/COLUMN starting at 1. Companion stores
// controls in one shared, zero-based page grid, with each surface positioned by
// its x/y offsets. Keep that implementation detail at this boundary so the UI,
// saved layouts, and parsers can consistently use CCB coordinates.
export function surfaceLocation(surface, location) {
  return {
    pageNumber: Number(location.page ?? location.pageNumber),
    row: Number(surface?.yOffset || 0) + Number(location.row) - 1,
    column: Number(surface?.xOffset || 0) + Number(location.column) - 1,
  };
}

export function ccbLocation(surface, location) {
  return {
    page: Number(location.page ?? location.pageNumber),
    row: Number(location.row) - Number(surface?.yOffset || 0) + 1,
    column: Number(location.column) - Number(surface?.xOffset || 0) + 1,
  };
}

export function normalizeSurface(id, info) {
  const rawColumns = Number(info?.gridSize?.columns);
  const rawRows = Number(info?.gridSize?.rows);
  if (!id || !Number.isInteger(rawColumns) || !Number.isInteger(rawRows) || rawColumns < 1 || rawRows < 1) return null;
  const rotation = Number(info?.config?.rotation || 0);
  const rotated = rotation === 90 || rotation === 270;
  const location = String(info?.location || info?.remoteAddress || info?.config?.location || '');
  const satellite = /satellite/i.test(`${id} ${info?.type || ''} ${info?.integrationType || ''} ${location}`) || /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(location) || /^[a-z0-9.-]+:\d+$/i.test(location);
  return {
    id,
    name: info.name || info.type || id,
    type: info.type || info.integrationType || 'Companion surface',
    columns: rotated ? rawRows : rawColumns,
    rows: rotated ? rawColumns : rawRows,
    xOffset: Number(info?.config?.xOffset || 0),
    yOffset: Number(info?.config?.yOffset || 0),
    rotation,
    enabled: info.enabled !== false,
    connected: info.connected !== false,
    satellite,
    location: location || null,
  };
}

function updateSurfaces(state, event) {
  if (!event) return state;
  if (event.type === 'init') {
    const entries = Array.isArray(event.info) ? event.info : Object.entries(event.info || {});
    return new Map(entries);
  }
  if (!state) state = new Map();
  if (event.type === 'add') state.set(event.itemId, event.info);
  if (event.type === 'remove') state.delete(event.itemId);
  if (event.type === 'update') state.set(event.itemId, { ...(state.get(event.itemId) || {}), ...event.info });
  return state;
}

export function surfaceCompatibility(surface, location) {
  if (!surface) return { compatible: false, reason: 'Select a connected Stream Deck before deploying.' };
  const minColumn = surface.xOffset;
  const maxColumn = surface.xOffset + surface.columns - 1;
  const minRow = surface.yOffset;
  const maxRow = surface.yOffset + surface.rows - 1;
  const compatible = location.column >= minColumn && location.column <= maxColumn && location.row >= minRow && location.row <= maxRow;
  return {
    compatible,
    reason: compatible ? null : `Page ${location.page}, row ${location.row}, column ${location.column} is outside ${surface.name}'s Companion-aligned grid (rows ${minRow}–${maxRow}, columns ${minColumn}–${maxColumn}).`,
  };
}

export const COMPANION_PAGE_GRID = Object.freeze({ columns: 9, rows: 4 });

function surfaceBoundsOverlap(left, right) {
  return left.xOffset < right.xOffset + right.columns
    && left.xOffset + left.columns > right.xOffset
    && left.yOffset < right.yOffset + right.rows
    && left.yOffset + left.rows > right.yOffset;
}

export function surfacesOverlap(surfaces = []) {
  return surfaces.some((surface, index) => surfaces.slice(index + 1).some((other) => surfaceBoundsOverlap(surface, other)));
}

function requiredSurfaceGrid(surfaces = []) {
  if (!surfaces.length) return { minColumn: 0, minRow: 0, maxColumn: -1, maxRow: -1, columns: 0, rows: 0 };
  const minColumn = Math.min(...surfaces.map((surface) => surface.xOffset));
  const minRow = Math.min(...surfaces.map((surface) => surface.yOffset));
  const maxColumn = Math.max(...surfaces.map((surface) => surface.xOffset + surface.columns - 1));
  const maxRow = Math.max(...surfaces.map((surface) => surface.yOffset + surface.rows - 1));
  return { minColumn, minRow, maxColumn, maxRow, columns: maxColumn - minColumn + 1, rows: maxRow - minRow + 1 };
}

export function expandCompanionGrid(current, required) {
  const fallback = { minColumn: 0, minRow: 0, maxColumn: 7, maxRow: 3 };
  const grid = { ...fallback, ...(current || {}) };
  if (!required?.columns || !required?.rows) return grid;
  return {
    minColumn: Math.min(grid.minColumn, required.minColumn),
    minRow: Math.min(grid.minRow, required.minRow),
    maxColumn: Math.max(grid.maxColumn, required.maxColumn),
    maxRow: Math.max(grid.maxRow, required.maxRow),
  };
}

export function planNonOverlappingSurfaceOffsets(surfaces = []) {
  if (!surfacesOverlap(surfaces)) return {
    changed: false,
    placements: surfaces.map(({ id, xOffset, yOffset }) => ({ id, xOffset, yOffset })),
    requiredGrid: requiredSurfaceGrid(surfaces),
  };
  const ordered = [...surfaces].sort((left, right) => (
    right.rows - left.rows || right.columns - left.columns || String(left.id).localeCompare(String(right.id))
  ));
  let nextColumn = 0;
  const placements = ordered.map((surface) => {
    const placement = { id: surface.id, xOffset: nextColumn, yOffset: 0, columns: surface.columns, rows: surface.rows };
    nextColumn += surface.columns;
    return placement;
  });
  return { changed: placements.some((placement) => {
    const original = surfaces.find((surface) => surface.id === placement.id);
    return original.xOffset !== placement.xOffset || original.yOffset !== placement.yOffset;
  }), placements: placements.map(({ id, xOffset, yOffset }) => ({ id, xOffset, yOffset })), requiredGrid: requiredSurfaceGrid(placements) };
}

export async function arrangeNonOverlappingSurfaces(address) {
  const surfaces = await discoverSurfaces(address);
  const plan = planNonOverlappingSurfaceOffsets(surfaces);
  if (!plan.changed) return { arranged: false, surfaces, requiredGrid: plan.requiredGrid };
  if (surfaces.some((surface) => surface.connected === false)) throw new Error('Connect every configured surface before automatic grid placement.');
  const rpc = new CompanionRpcClient(address);
  const changed = [];
  let gridExpanded = false;
  try {
    await rpc.connect();
    const config = await rpc.query('userconfig.getConfig', undefined);
    const currentGrid = config?.gridSize;
    const expandedGrid = expandCompanionGrid(currentGrid, plan.requiredGrid);
    if (JSON.stringify(expandedGrid) !== JSON.stringify(currentGrid)) {
      await rpc.mutate('userconfig.setConfigKey', { key: 'gridSize', value: expandedGrid });
      gridExpanded = true;
    }
    for (const placement of plan.placements) {
      const surface = surfaces.find((item) => item.id === placement.id);
      for (const key of ['xOffset', 'yOffset']) {
        if (surface[key] === placement[key]) continue;
        await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: surface.id, key, value: placement[key] });
        changed.push({ surface, key });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    const updated = await discoverSurfaces(address);
    if (surfacesOverlap(updated)) throw new Error('Companion did not retain the automatic non-overlapping surface placement.');
    return { arranged: true, surfaces: updated, requiredGrid: plan.requiredGrid, gridExpanded };
  } catch (error) {
    for (const entry of changed.reverse()) {
      await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: entry.surface.id, key: entry.key, value: entry.surface[entry.key] }).catch(() => {});
    }
    throw error;
  } finally { rpc.close(); }
}

export function surfaceGridOverflow(surfaces, grid = COMPANION_PAGE_GRID) {
  return surfaces.some((surface) => surface.xOffset < 0 || surface.yOffset < 0
    || surface.xOffset + surface.columns > grid.columns
    || surface.yOffset + surface.rows > grid.rows);
}

export function planFullGridMigration(surfaces, controls = [], grid = COMPANION_PAGE_GRID) {
  if (!surfaces.length || !surfaceGridOverflow(surfaces, grid)) return { delta: { x: 0, y: 0 }, moves: [], collisions: [] };
  const delta = {
    x: Math.min(...surfaces.map((surface) => surface.xOffset)) > 0 ? -1 : 0,
    y: Math.min(...surfaces.map((surface) => surface.yOffset)) > 0 ? -1 : 0,
  };
  if (!delta.x && !delta.y) return { delta, moves: [], collisions: [{ reason: 'configured surfaces exceed the Companion page grid and cannot be compacted toward the origin' }] };
  const sourceKeys = new Set();
  const moves = [];
  for (const control of controls) {
    const onSurface = surfaces.some((surface) => control.row >= surface.yOffset && control.row < surface.yOffset + surface.rows && control.column >= surface.xOffset && control.column < surface.xOffset + surface.columns);
    if (!onSurface) continue;
    const move = { controlId: control.controlId, from: { pageNumber: control.pageNumber, row: control.row, column: control.column }, to: { pageNumber: control.pageNumber, row: control.row + delta.y, column: control.column + delta.x } };
    moves.push(move);
    sourceKeys.add(`${control.pageNumber}/${control.row}/${control.column}`);
  }
  const occupied = new Map(controls.map((control) => [`${control.pageNumber}/${control.row}/${control.column}`, control.controlId]));
  const collisions = moves.filter((move) => occupied.has(`${move.to.pageNumber}/${move.to.row}/${move.to.column}`) && !sourceKeys.has(`${move.to.pageNumber}/${move.to.row}/${move.to.column}`));
  // Moving up/left must start at the nearest edge so each destination is freed.
  moves.sort((a, b) => a.from.pageNumber - b.from.pageNumber || a.from.row - b.from.row || a.from.column - b.from.column);
  return { delta, moves, collisions };
}

export function planOneBasedGridMigration(surfaces, controls = []) {
  const delta = {
    x: surfaces.some((surface) => surface.xOffset === 0) ? 1 : 0,
    y: surfaces.some((surface) => surface.yOffset === 0) ? 1 : 0,
  };
  if (!surfaces.length || (!delta.x && !delta.y)) return { delta, moves: [], collisions: [] };
  const sourceKeys = new Set();
  const moves = [];
  for (const control of controls) {
    const { pageNumber, row, column } = control;
    const onSurface = surfaces.some((surface) => row >= surface.yOffset && row < surface.yOffset + surface.rows && column >= surface.xOffset && column < surface.xOffset + surface.columns);
    if (!onSurface) continue;
    const move = { controlId: control.controlId, from: { pageNumber, row, column }, to: { pageNumber, row: row + delta.y, column: column + delta.x } };
    moves.push(move);
    sourceKeys.add(`${pageNumber}/${row}/${column}`);
  }
  const occupied = new Map(controls.map((control) => [`${control.pageNumber}/${control.row}/${control.column}`, control.controlId]));
  const collisions = moves.filter((move) => occupied.has(`${move.to.pageNumber}/${move.to.row}/${move.to.column}`) && !sourceKeys.has(`${move.to.pageNumber}/${move.to.row}/${move.to.column}`));
  moves.sort((a, b) => b.from.pageNumber - a.from.pageNumber || b.from.row - a.from.row || b.from.column - a.from.column);
  return { delta, moves, collisions };
}

export async function reserveOneBasedCompanionGrid(address) {
  const surfaces = await discoverSurfaces(address);
  const initial = planOneBasedGridMigration(surfaces);
  const delta = initial.delta;
  if (!surfaces.length || (!delta.x && !delta.y)) {
    return { migrated: false, surfaces, movedControls: 0 };
  }
  const disconnected = surfaces.filter((surface) => surface.connected === false);
  if (disconnected.length) throw new Error(`Connect every configured surface before coordinate alignment. Waiting for: ${disconnected.map((surface) => surface.name).join(', ')}.`);
  const rpc = new CompanionRpcClient(address);
  let pageState = null;
  const moved = [];
  const configured = [];
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    if (pageState?.type !== 'init') throw new Error('Companion did not return its button layout for coordinate migration.');

    const controls = [];
    for (let pageIndex = 0; pageIndex < pageState.order.length; pageIndex += 1) {
      const pageNumber = pageIndex + 1;
      const page = pageState.pages?.[pageState.order[pageIndex]];
      for (const [rowText, columns] of Object.entries(page?.controls || {})) for (const [columnText, controlId] of Object.entries(columns || {})) {
        if (!controlId) continue;
        const row = Number(rowText); const column = Number(columnText);
        controls.push({ controlId, pageNumber, row, column });
      }
    }
    const migration = planOneBasedGridMigration(surfaces, controls);
    if (migration.collisions.length) {
      const collision = migration.collisions[0].to;
      throw new Error(`Cannot reserve row/column 0 because Companion ${collision.pageNumber}/${collision.row}/${collision.column} is occupied outside the device layout.`);
    }
    for (const item of migration.moves) {
      const result = await rpc.mutate('controls.moveControl', { fromLocation: item.from, toLocation: item.to });
      if (result !== true) throw new Error(`Companion could not shift control ${item.from.pageNumber}/${item.from.row}/${item.from.column}.`);
      moved.push(item);
    }
    for (const surface of surfaces) {
      if (delta.x) {
        await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: surface.id, key: 'xOffset', value: surface.xOffset + delta.x });
        configured.push({ surface, key: 'xOffset' });
      }
      if (delta.y) {
        await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: surface.id, key: 'yOffset', value: surface.yOffset + delta.y });
        configured.push({ surface, key: 'yOffset' });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    const updatedSurfaces = await discoverSurfaces(address);
    const failed = surfaces.find((surface) => {
      const updated = updatedSurfaces.find((candidate) => candidate.id === surface.id);
      return !updated || updated.xOffset !== surface.xOffset + delta.x || updated.yOffset !== surface.yOffset + delta.y;
    });
    if (failed) throw new Error(`Companion did not retain the migrated grid origin for ${failed.name}. Keep every intended surface connected and retry.`);
    return { migrated: true, movedControls: moved.length, offsetShift: delta, surfaces: updatedSurfaces };
  } catch (error) {
    for (const entry of configured.reverse()) await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: entry.surface.id, key: entry.key, value: entry.key === 'xOffset' ? entry.surface.xOffset : entry.surface.yOffset }).catch(() => {});
    for (const item of moved.reverse()) await rpc.mutate('controls.moveControl', { fromLocation: item.to, toLocation: item.from }).catch(() => {});
    throw error;
  } finally { rpc.close(); }
}

export async function restoreFullCompanionGrid(address) {
  const surfaces = await discoverSurfaces(address);
  if (!surfaceGridOverflow(surfaces)) return { migrated: false, surfaces, movedControls: 0, offsetShift: { x: 0, y: 0 } };
  const disconnected = surfaces.filter((surface) => surface.connected === false);
  if (disconnected.length) throw new Error(`Connect every configured surface before repairing the grid. Waiting for: ${disconnected.map((surface) => surface.name).join(', ')}.`);
  const rpc = new CompanionRpcClient(address);
  let pageState = null;
  const moved = [];
  const configured = [];
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    if (pageState?.type !== 'init') throw new Error('Companion did not return its button layout for grid repair.');
    const controls = [];
    for (let pageIndex = 0; pageIndex < pageState.order.length; pageIndex += 1) {
      const pageNumber = pageIndex + 1;
      const page = pageState.pages?.[pageState.order[pageIndex]];
      for (const [rowText, columns] of Object.entries(page?.controls || {})) for (const [columnText, controlId] of Object.entries(columns || {})) {
        if (controlId) controls.push({ controlId, pageNumber, row: Number(rowText), column: Number(columnText) });
      }
    }
    const migration = planFullGridMigration(surfaces, controls);
    if (migration.collisions.length) throw new Error(`The connected surfaces cannot be compacted safely: ${migration.collisions[0].reason || 'a destination cell is occupied outside the device layout'}.`);
    for (const item of migration.moves) {
      const result = await rpc.mutate('controls.moveControl', { fromLocation: item.from, toLocation: item.to });
      if (result !== true) throw new Error(`Companion could not move ${ccbGlobalLocation(item.from).page}/${ccbGlobalLocation(item.from).row}/${ccbGlobalLocation(item.from).column} during grid repair.`);
      moved.push(item);
    }
    for (const surface of surfaces) {
      if (migration.delta.x) {
        await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: surface.id, key: 'xOffset', value: surface.xOffset + migration.delta.x });
        configured.push({ surface, key: 'xOffset' });
      }
      if (migration.delta.y) {
        await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: surface.id, key: 'yOffset', value: surface.yOffset + migration.delta.y });
        configured.push({ surface, key: 'yOffset' });
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    const updatedSurfaces = await discoverSurfaces(address);
    if (surfaceGridOverflow(updatedSurfaces)) throw new Error('Companion did not retain the repaired surface offsets.');
    return { migrated: true, movedControls: moved.length, offsetShift: migration.delta, surfaces: updatedSurfaces };
  } catch (error) {
    for (const entry of configured.reverse()) await rpc.mutate('surfaces.surfaceSetConfigKey', { surfaceId: entry.surface.id, key: entry.key, value: entry.key === 'xOffset' ? entry.surface.xOffset : entry.surface.yOffset }).catch(() => {});
    for (const item of moved.reverse()) await rpc.mutate('controls.moveControl', { fromLocation: item.to, toLocation: item.from }).catch(() => {});
    throw error;
  } finally { rpc.close(); }
}

function isLocalCompanion(address) {
  const host = String(address || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  return /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host) || /^\[::1\](?::\d+)?$/.test(host);
}

export async function discoverLocalSurfaces() {
  const database = join(homedir(), 'Library', 'Application Support', 'companion', 'v5.0', 'db.sqlite');
  const [{ stdout }, usb] = await Promise.all([
    execFileAsync('/usr/bin/sqlite3', ['-json', database, 'select id,value from surfaces;'], { timeout: 2500, maxBuffer: 1024 * 1024 }),
    execFileAsync('/usr/sbin/ioreg', ['-p', 'IOUSB', '-l', '-w0'], { timeout: 2500, maxBuffer: 4 * 1024 * 1024 }).catch(() => ({ stdout: '' })),
  ]);
  const rows = JSON.parse(stdout || '[]');
  return rows.map((row) => {
    try {
      const serial = row.id.includes(':') ? row.id.slice(row.id.indexOf(':') + 1) : '';
      return normalizeSurface(row.id, { ...JSON.parse(row.value), connected: Boolean(serial && usb.stdout.includes(serial)) });
    } catch { return null; }
  }).filter((surface) => surface?.enabled);
}

export async function discoverSurfaces(address, { satelliteAddress } = {}) {
  const rpc = new CompanionRpcClient(address);
  let state = null;
  try {
    await rpc.connect();
    const subscription = rpc.subscribe('surfaces.watchSurfaces', undefined, (event) => {
      for (const item of Array.isArray(event) ? event : [event]) state = updateSurfaces(state, item);
    });
    await subscription.started;
    for (let attempt = 0; attempt < 80 && !state; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const discovered = [...(state || new Map())].map(([id, info]) => normalizeSurface(id, info)).filter((surface) => surface?.enabled);
    const configured = discovered.length || !isLocalCompanion(address) ? discovered : await discoverLocalSurfaces().catch(() => discovered);
    if (satelliteAddress) {
      const probe = await probeSatellite(satelliteAddress).catch(() => null);
      if (probe) satellitePresence.set(String(address || ''), { ...probe, checkedAt: Date.now() });
      else satellitePresence.delete(String(address || ''));
    }
    return applyCachedSatellitePresence(address, configured);
  } finally { rpc.close(); }
}

export async function discoverPages(address) {
  const rpc = new CompanionRpcClient(address);
  let pageState = null;
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    if (pageState?.type !== 'init') throw new Error('Companion did not return its page list.');
    return pageState.order.map((id, index) => ({ id, pageNumber: index + 1, name: pageState.pages?.[id]?.name || `Layer ${index + 1}` }));
  } finally { rpc.close(); }
}

export async function addCompanionPage(address, pageNumber, name) {
  const rpc = new CompanionRpcClient(address);
  try {
    await rpc.connect();
    const result = await rpc.mutate('pages.insert', { asPageNumber: pageNumber, pageNames: [name] });
    if (result !== 'ok') throw new Error('Companion did not create the new layer.');
    return { added: true, pageNumber, name };
  } finally { rpc.close(); }
}

export async function removeCompanionPage(address, pageNumber) {
  const rpc = new CompanionRpcClient(address);
  try {
    await rpc.connect();
    const result = await rpc.mutate('pages.remove', { pageNumber });
    if (result !== 'ok') throw new Error('Companion requires at least one layer and did not remove this page.');
    return { removed: true, pageNumber };
  } finally { rpc.close(); }
}

export function surfaceRotaryLocations(surface) {
  const type = String(surface?.type || surface?.name || '').toLowerCase();
  if (type.includes('stream deck +') || type.includes('stream deck plus')) {
    return Array.from({ length: surface.columns }, (_, column) => ({ row: surface.rows, column: column + 1 }));
  }
  if (type.includes('stream deck studio')) return [{ row: 1, column: 1 }, { row: 1, column: surface.columns }];
  return [];
}

async function watchInitialPages(rpc) {
  let state = null;
  const subscription = rpc.subscribe('pages.watch', undefined, (payload) => {
    for (const event of Array.isArray(payload) ? payload : [payload]) state = updatePages(state, event);
  });
  await subscription.started;
  for (let attempt = 0; attempt < 80 && !state; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
  if (state?.type !== 'init') throw new Error('Companion did not return its button layout.');
  return state;
}

export async function clearSurfacePage(address, surface, pageNumber) {
  const rpc = new CompanionRpcClient(address);
  try {
    await rpc.connect();
    const state = await watchInitialPages(rpc);
    const entries = pageControlEntries(state, pageNumber).filter((button) =>
      button.row > surface.yOffset && button.row <= surface.yOffset + surface.rows
      && button.column > surface.xOffset && button.column <= surface.xOffset + surface.columns
    );
    for (const button of entries) await rpc.mutate('controls.resetControl', { location: { pageNumber, row: button.row - 1, column: button.column - 1 } });
    return { cleared: true, count: entries.length, pageNumber, surfaceId: surface.id };
  } finally { rpc.close(); }
}

export async function addSurfaceLayerScroll(address, surface, pageNumber) {
  const rpc = new CompanionRpcClient(address);
  try {
    await rpc.connect();
    const state = await watchInitialPages(rpc);
    const rotary = new Set(surfaceRotaryLocations(surface).map(({ row, column }) => `${row}/${column}`));
    const available = [];
    for (let row = surface.rows; row >= 1; row -= 1) {
      for (let column = surface.columns; column >= 1; column -= 1) {
        if (rotary.has(`${row}/${column}`)) continue;
        const location = { pageNumber, row: row + surface.yOffset - 1, column: column + surface.xOffset - 1 };
        if (!controlAt(state, location)) available.push(location);
      }
    }
    if (available.length < 2) throw new Error('Two empty physical keys are required to add previous/next layer controls.');
    const previous = available[1];
    const next = available[0];
    await rpc.mutate('controls.resetControl', { location: previous, newType: 'pagedown' });
    try { await rpc.mutate('controls.resetControl', { location: next, newType: 'pageup' }); }
    catch (error) { await rpc.mutate('controls.resetControl', { location: previous }).catch(() => {}); throw error; }
    return {
      added: true,
      pageNumber,
      previous: ccbGlobalLocation(previous),
      next: ccbGlobalLocation(next),
    };
  } finally { rpc.close(); }
}

export async function initializeSurfaceEncoders(address, surface, pageNumber) {
  const rotaryLocations = surfaceRotaryLocations(surface);
  if (!rotaryLocations.length) throw new Error(`${surface.name} does not report a supported physical encoder layout.`);
  const rpc = new CompanionRpcClient(address);
  let created = 0;
  let enabled = 0;
  try {
    await rpc.connect();
    const state = await watchInitialPages(rpc);
    for (const local of rotaryLocations) {
      const location = { pageNumber, row: local.row + surface.yOffset - 1, column: local.column + surface.xOffset - 1 };
      let controlId = controlAt(state, location);
      if (!controlId) {
        await rpc.mutate('controls.resetControl', { location, newType: 'button-layered' });
        created += 1;
        for (let attempt = 0; attempt < 20 && !controlAt(state, location); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
        controlId = controlAt(state, location);
      }
      if (!controlId) continue;
      const changed = await rpc.mutate('controls.setOptionsField', { controlId, key: 'rotaryActions', value: true }).catch(() => false);
      if (changed) enabled += 1;
    }
    return { initialized: true, pageNumber, created, enabled, count: rotaryLocations.length };
  } finally { rpc.close(); }
}

export async function setCompanionSurfacePage(address, surfaceId, pageNumber) {
  if (!surfaceId) throw new Error('Select a connected Stream Deck before changing layers.');
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new Error('A valid Companion layer is required.');
  const rpc = new CompanionRpcClient(address);
  let pageState = null;
  let temporaryLocation = null;
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    if (pageState?.type !== 'init' || !pageState.order?.[pageNumber - 1]) throw new Error(`Companion layer ${pageNumber} does not exist.`);
    for (let row = 31; row >= 0 && !temporaryLocation; row -= 1) {
      for (let column = 31; column >= 0; column -= 1) {
        const candidate = { pageNumber: 1, row, column };
        if (controlAt(pageState, candidate)) continue;
        try {
          await rpc.mutate('controls.resetControl', { location: candidate, newType: 'button-layered' });
          temporaryLocation = candidate;
          break;
        } catch {
          // The Companion global grid may be smaller than 32×32. Keep looking.
        }
      }
    }
    if (!temporaryLocation) throw new Error('Companion has no free temporary control location for changing the device layer.');
    for (let attempt = 0; attempt < 20 && !controlAt(pageState, temporaryLocation); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const controlId = controlAt(pageState, temporaryLocation);
    if (!controlId) throw new Error('Companion could not prepare the device layer change.');
    await addAction(rpc, controlId, 'internal', '0', { definitionId: 'set_page', options: { surfaceId, page: pageNumber } });
    await rpc.mutate('controls.hotPressControl', { location: temporaryLocation, direction: true, surfaceId: 'ccb-layer-follow' });
    await rpc.mutate('controls.hotPressControl', { location: temporaryLocation, direction: false, surfaceId: 'ccb-layer-follow' });
    return { changed: true, surfaceId, pageNumber };
  } finally {
    if (temporaryLocation) await rpc.mutate('controls.resetControl', { location: temporaryLocation }).catch(() => {});
    rpc.close();
  }
}

export function actionDefinitions(action) {
  if (action.family === 'channel-insert') throw new Error('Insert A/B uses CCB’s guarded DiGiCo Pad transport and cannot be deployed through digico_osc 1.0.4. Complete the Quantum 338 read-back probe before enabling direct writes.');
  if (action.family === 'variable-display') return [];
  if (action.family === 'dynamic') return action.definitions.map((definition) => ({ definitionId: definition.definitionId, options: { ...definition.options } }));
  if (action.family === 'midi') {
    if (action.operation === 'sysex') return [{ definitionId: 'sysex', options: { bytes: action.bytes } }];
    if (action.operation === 'momentary-cc') return [
      { phase: 'press', definitionId: 'cc', options: { channel: action.channel, controller: action.press.controller, value: action.press.value, useVariables: false, relValue: false, sendOverTime: false } },
      { phase: 'release', definitionId: 'cc', options: { channel: action.channel, controller: action.release.controller, value: action.release.value, useVariables: false, relValue: false, sendOverTime: false } },
    ];
    if (action.operation === 'cc') return [{ definitionId: 'cc', options: { channel: action.channel, controller: action.controller, value: action.value, useVariables: false, relValue: false, sendOverTime: false } }];
    if (action.operation === 'program') return [{ definitionId: 'program', options: { channel: action.channel, program: action.program, useVariables: false, relValue: false, sendOverTime: false } }];
    if (action.operation === 'pitch') return [{ definitionId: 'pitch', options: { channel: action.channel, value: action.value, useVariables: false, relValue: false, sendOverTime: false } }];
    return [{ definitionId: action.operation, options: { channel: action.channel, note: action.note, velocity: action.velocity, useVariables: false, relValue: false, sendOverTime: false } }];
  }
  if (action.family === 'macro') return [{ definitionId: 'macros', options: { macro: action.macro } }];
  if (action.family === 'snapshot') {
    if (action.operation === 'next-snapshot') return [{ definitionId: 'snapshotNext', options: {} }];
    if (action.operation === 'previous-snapshot') return [{ definitionId: 'snapshotPrev', options: {} }];
    return [{ definitionId: 'snapshot', options: { snapshot: action.snapshot } }];
  }
  const operationValue = action.operation === 'unmute' ? '0' : '1';
  if (action.family === 'channel-fader') return action.channels.map((channel) => ({ definitionId: 'fader', options: { channel, fader: action.levelDb === 'OFF' ? -150 : action.levelDb } }));
  const targets = action.family === 'aux-mute' ? action.auxes : action.family === 'control-group-mute' ? action.controlGroups : action.channels;
  const definitionId = action.family === 'aux-mute' ? 'auxmute' : action.family === 'control-group-mute' ? 'cgmute' : 'mute';
  return targets.map((channel) => ({ definitionId, options: { channel, [definitionId]: operationValue } }));
}

export function actionManifest(action) {
  if (action.family === 'variable-display') return [{
    step: 1, actionId: 'live-variable-display',
    summary: `Display Shure channel ${action.channel} ${action.operation === 'show-frequency' ? 'frequency' : 'audio gain'}`,
    options: { variableId: action.variableId },
  }];
  if (action.family === 'channel-insert') {
    const enabled = action.operation === 'enable-insert' ? true : action.operation === 'disable-insert' ? false : null;
    return action.slots.flatMap((slot) => action.channels.map((channel, index) => ({
      step: index + 1,
      actionId: `channel.insert${slot}.enabled`,
      summary: `DiGiCo Pad · Channel ${channel} · Insert ${slot} ${enabled == null ? 'toggle (requires state read-back)' : enabled ? 'ON' : 'BYPASS'}`,
      options: { channel, enabled, transport: 'digico-pad', verification: 'quantum-readback-required' },
    })));
  }
  const definitions = actionDefinitions(action);
  if (action.family === 'dynamic') return definitions.map((definition, index) => ({ step: index + 1, actionId: definition.definitionId, summary: `Run ${action.definitions[index]?.name || definition.definitionId}`, options: { ...definition.options } }));
  if (action.family === 'midi') return definitions.map((definition, index) => ({
    step: index + 1, actionId: definition.definitionId,
    summary: definition.phase ? `${definition.phase === 'press' ? 'Press' : 'Release'} · Send MIDI CC ${definition.options.controller} value ${definition.options.value} on channel ${definition.options.channel}`
      : definition.definitionId === 'sysex' ? `Send MIDI SysEx ${definition.options.bytes}`
      : `Send MIDI ${definition.definitionId}${definition.options.channel ? ` on channel ${definition.options.channel}` : ''}`,
    options: { ...definition.options }, ...(definition.phase ? { phase: definition.phase } : {}),
  }));
  const describe = (definition, step, value = definition.options[definition.definitionId]) => {
    if (definition.definitionId === 'macros') return { step, actionId: definition.definitionId, summary: `Fire macro ${definition.options.macro}`, options: { ...definition.options } };
    if (definition.definitionId === 'snapshot') return { step, actionId: definition.definitionId, summary: `Fire snapshot ${definition.options.snapshot}`, options: { ...definition.options } };
    if (definition.definitionId === 'snapshotNext' || definition.definitionId === 'snapshotPrev') return { step, actionId: definition.definitionId, summary: `Fire ${definition.definitionId === 'snapshotNext' ? 'next' : 'previous'} snapshot`, options: {} };
    const target = definition.definitionId === 'auxmute' ? 'Aux' : definition.definitionId === 'cgmute' ? 'Control group' : 'Channel';
    const behavior = definition.definitionId === 'fader'
      ? `set fader to ${definition.options.fader === -150 ? 'OFF' : `${definition.options.fader > 0 ? '+' : ''}${definition.options.fader} dB`}`
      : `${value === '1' ? 'mute ON' : 'mute OFF'}`;
    return { step, actionId: definition.definitionId, summary: `${target} ${definition.options.channel}: ${behavior}`, options: { ...definition.options, ...(definition.definitionId === 'fader' ? {} : { [definition.definitionId]: value }) } };
  };
  if (action.operation === 'toggle-mute') return [
    ...definitions.map((definition) => describe(definition, 1, '1')),
    ...definitions.map((definition) => describe(definition, 2, '0')),
  ];
  return definitions.map((definition) => describe(definition, 1));
}

function colorNumber(hex) { return Number.parseInt(hex.replace('#', ''), 16); }

// Keep a leading pictogram from consuming the same line as the label. Companion
// can then shrink the complete word as one unit instead of wrapping STOP into
// fragments such as ST / OP.
export function fitButtonText(value) {
  return String(value ?? '').replace(/^([^\p{L}\p{N}\s]{1,3})[ \t]*(\p{L}[\p{L}\p{N} ]*)$/u, '$1\n$2');
}

export function resolvedButtonText(plan, connectionLabel) {
  const action = plan?.button?.action;
  if (action?.family !== 'variable-display') return fitButtonText(plan?.button?.text);
  return `${action.prefix || 'VALUE'}\n$(${connectionLabel}:${action.variableId})`;
}

export function toggleStateFeedbackDefinition(appearance) {
  if (!appearance?.states) return null;
  return {
    connectionId: 'internal',
    definitionId: 'bank_current_step',
    options: { step: 2 },
    overrides: [
      { overrideId: 'ccb-muted-background', elementId: 'box0', elementProperty: 'color', override: { value: colorNumber(appearance.states.muted.backgroundColor), isExpression: false } },
      { overrideId: 'ccb-muted-text', elementId: 'text0', elementProperty: 'color', override: { value: colorNumber(appearance.states.muted.textColor), isExpression: false } },
    ],
  };
}
function controlAt(state, location) {
  if (state?.type !== 'init') return null;
  const pageId = state.order?.[location.pageNumber - 1];
  return state.pages?.[pageId]?.controls?.[location.row]?.[location.column] || null;
}
function updatePages(state, event) {
  if (event?.type === 'init') return structuredClone(event);
  if (!state || !event) return state;
  for (const change of event.changes || []) {
    const page = state.pages?.[change.id];
    if (!page) continue;
    for (const item of change.controls || []) {
      page.controls[item.row] ||= {};
      if (item.controlId) page.controls[item.row][item.column] = item.controlId;
      else delete page.controls[item.row][item.column];
    }
  }
  return state;
}

export function moveReadbackStatus(state, fromLocation, toLocation, sourceControlId) {
  const source = controlAt(state, fromLocation);
  const destination = controlAt(state, toLocation);
  if (!source && destination) return { status: 'moved', source, destination };
  if (source === sourceControlId && !destination) return { status: 'unchanged', source, destination };
  if (!source && !destination) return { status: 'missing', source, destination };
  return { status: 'conflict', source, destination };
}

async function readFreshPageState(rpc) {
  let state = null;
  const subscription = rpc.subscribe('pages.watch', undefined, (payload) => {
    for (const event of Array.isArray(payload) ? payload : [payload]) state = updatePages(state, event);
  });
  try {
    await subscription.started;
    for (let attempt = 0; attempt < 80 && !state; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    return state;
  } finally { subscription.stop(); }
}
function findModuleConnection(events, moduleId, requestedLabel) {
  for (const event of events) {
    if (event.type !== 'init') continue;
    const match = Object.entries(event.info || {}).find(([, info]) => info.moduleId === moduleId && (!requestedLabel || info.label === requestedLabel));
    if (match) return { id: match[0], ...match[1] };
  }
  return null;
}
export async function discoverConnections(address) {
  const rpc = new CompanionRpcClient(address);
  const events = [];
  try {
    await rpc.connect();
    const subscription = rpc.subscribe('instances.connections.watch', undefined, (payload) => events.push(...(Array.isArray(payload) ? payload : [payload])));
    await subscription.started;
    for (let attempt = 0; attempt < 40 && !events.some((event) => event.type === 'init'); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const init = events.find((event) => event.type === 'init');
    return Object.entries(init?.info || {}).map(([id, info]) => ({ id, label: info.label, moduleId: info.moduleId, moduleVersionId: info.moduleVersionId, enabled: info.enabled !== false }));
  } finally { rpc.close(); }
}

export function applyDefinitionEvent(current, event, connectionId) {
  let next = current;
  for (const update of Array.isArray(event) ? event : [event]) {
    if (!update || typeof update !== 'object') continue;
    const owner = update.connectionId || update.instanceId || update.instance || update.id;
    const collection = update.definitions || update.info || update.data || update.value;
    if (collection && typeof collection === 'object' && !Array.isArray(collection)) {
      const owned = collection[connectionId];
      if (owned && typeof owned === 'object') next = { ...(next || {}), ...owned };
      else if (owner === connectionId) {
        const values = collection.actions || collection.feedbacks || collection.definitions || collection;
        if (values && typeof values === 'object' && !Array.isArray(values)) next = { ...(next || {}), ...values };
      }
    }
    if (owner === connectionId && update.definition && (update.definitionId || update.actionId || update.feedbackId)) {
      next = { ...(next || {}), [update.definitionId || update.actionId || update.feedbackId]: update.definition };
    }
    if (owner === connectionId && /delete|remove/i.test(update.type || '') && (update.definitionId || update.actionId || update.feedbackId)) {
      next = { ...(next || {}) }; delete next[update.definitionId || update.actionId || update.feedbackId];
    }
  }
  return next;
}

export async function discoverConnectionDefinitions(address, connectionId) {
  const rpc = new CompanionRpcClient(address, { timeoutMs: 8000 });
  let actions = null;
  let feedbacks = null;
  try {
    await rpc.connect();
    let lastUpdate = Date.now();
    const actionSubscription = rpc.subscribe('instances.definitions.actions', undefined, (event) => { actions = applyDefinitionEvent(actions, event, connectionId); lastUpdate = Date.now(); });
    const feedbackSubscription = rpc.subscribe('instances.definitions.feedbacks', undefined, (event) => { feedbacks = applyDefinitionEvent(feedbacks, event, connectionId); lastUpdate = Date.now(); });
    await Promise.all([actionSubscription.started, feedbackSubscription.started]);
    for (let attempt = 0; attempt < 320; attempt += 1) {
      const hasActions = actions && Object.keys(actions).length;
      const settled = actions !== null && feedbacks !== null && Date.now() - lastUpdate >= 300;
      if (hasActions && settled) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    actionSubscription.stop(); feedbackSubscription.stop();
    if (!actions || !Object.keys(actions).length) throw new Error('Companion returned no live actions for this connection. Make sure the module connection is enabled and running, then refresh inventory.');
    return { actions, feedbacks };
  } finally { rpc.close(); }
}

export async function validateDynamicAdapterReadback(address, connectionId, surface, pageNumber, adapter, requested = {}) {
  const candidate = requested.actionId
    ? adapter.actions.find((action) => action.id === requested.actionId)
    : adapter.actions.find((action) => action.options.every((option) => !option.required || option.default != null));
  if (requested.actionId && !candidate) throw new Error(`Action “${requested.actionId}” is not in the live ${adapter.name} schema.`);
  if (!candidate) throw new Error('No action has safe defaults for automatic read-back validation. Operator parameters are required.');
  const supplied = requested.options && typeof requested.options === 'object' ? requested.options : {};
  const allowed = new Set(candidate.options.map((option) => option.id));
  for (const key of Object.keys(supplied)) if (!allowed.has(key)) throw new Error(`Option “${key}” is not valid for ${candidate.name}.`);
  const options = Object.fromEntries(candidate.options.flatMap((option) => {
    const value = Object.prototype.hasOwnProperty.call(supplied, option.id) ? supplied[option.id] : option.default;
    if (value == null && option.required) throw new Error(`${option.label || option.id} is required for safe read-back validation.`);
    return value == null ? [] : [[option.id, value]];
  }));
  const rpc = new CompanionRpcClient(address, { timeoutMs: 8000 });
  let pageState = null;
  let location = null;
  let controlId = null;
  let result = null;
  let primaryError = null;
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => { for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event); });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    for (let row = 1; row <= surface.rows && !location; row += 1) for (let column = 1; column <= surface.columns && !location; column += 1) {
      const test = { pageNumber, row: surface.yOffset + row - 1, column: surface.xOffset + column - 1 };
      if (!controlAt(pageState, test)) location = test;
    }
    if (!location) throw new Error('No empty key is available for temporary read-back validation.');
    await rpc.mutate('controls.resetControl', { location, newType: 'button-layered' });
    for (let attempt = 0; attempt < 30 && !controlAt(pageState, location); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    controlId = controlAt(pageState, location);
    if (!controlId) throw new Error('Companion did not return the temporary validation control.');
    await addAction(rpc, controlId, connectionId, '0', { definitionId: candidate.id, options });
    let config = null;
    const control = rpc.subscribe('controls.watchControl', { controlId }, (event) => { if (event?.type === 'init' || event?.config) config = event.config || event; });
    await control.started;
    for (let attempt = 0; attempt < 80 && !config; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    control.stop();
    const readback = extractControlActions(config || {}).find((action) => action.definitionId === candidate.id);
    if (!readback) throw new Error(`Temporary action “${candidate.id}” was not returned by Companion.`);
    for (const [key, value] of Object.entries(options)) if (JSON.stringify(readback.options[key]) !== JSON.stringify(value)) throw new Error(`Read-back mismatch for ${candidate.id}.${key}.`);
    result = { verified: true, actionId: candidate.id, options, location: { page: pageNumber, row: location.row, column: location.column } };
  } catch (error) {
    primaryError = error;
  } finally {
    if (location) {
      try {
        await rpc.mutate('controls.resetControl', { location });
        for (let attempt = 0; attempt < 40 && controlAt(pageState, location); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
        if (controlAt(pageState, location)) {
          const fresh = await readFreshPageState(rpc);
          if (controlAt(fresh, location)) throw new Error(`Temporary validation control ${controlId || ''} was not removed from ${pageNumber}/${location.row}/${location.column}.`);
        }
        if (result) result.cleanedUp = true;
      } catch (cleanupError) {
        primaryError = primaryError
          ? new Error(`${primaryError.message} Cleanup also failed: ${cleanupError.message}`)
          : cleanupError;
      }
    }
    rpc.close();
  }
  if (primaryError) throw primaryError;
  return result;
}

async function waitForConnectionEditState(rpc, connectionId) {
  let state = null;
  let lastUpdate = 0;
  const subscription = rpc.subscribe('instances.connections.watchEdit', { connectionId }, (payload) => {
    const updates = Array.isArray(payload) ? payload : [payload];
    for (const update of updates) {
      if (update && typeof update === 'object') state = update.data && typeof update.data === 'object' ? update.data : update;
    }
    lastUpdate = Date.now();
  });
  await subscription.started;
  for (let attempt = 0; attempt < 320; attempt += 1) {
    const settledConfig = state?.type === 'config' && lastUpdate && Date.now() - lastUpdate >= 300;
    const terminal = state?.type === 'error' || (state?.type === 'notRunning' && state.reason !== 'starting');
    if (settledConfig || terminal) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  subscription.stop();
  if (!state) throw new Error('Companion did not return the connection configuration fields.');
  if (state.type === 'error') throw new Error(state.message || 'The Companion module could not be started.');
  if (state.type === 'notRunning') throw new Error(`The Companion connection is not running (${state.reason || 'unknown reason'}).`);
  if (state.type !== 'config') throw new Error('The Companion module is still starting. Try again in a moment.');
  return {
    ...state,
    fields: state.fields || state.configFields || [],
    config: state.config || state.values || {},
    secrets: state.secrets || state.secretValues || {},
  };
}

export async function readConnectionConfig(address, connectionId) {
  const rpc = new CompanionRpcClient(address, { timeoutMs: 8000 });
  try {
    await rpc.connect();
    const state = await waitForConnectionEditState(rpc, connectionId);
    return {
      connectionId,
      fields: state.fields || [],
      config: state.config || {},
      secrets: state.secrets || {},
      useNewLayout: state.useNewLayout !== false,
    };
  } finally { rpc.close(); }
}

export async function createConnectionDraft(address, moduleInfo, label) {
  const rpc = new CompanionRpcClient(address, { timeoutMs: 8000 });
  let connectionId = null;
  try {
    await rpc.connect();
    connectionId = await rpc.mutate('instances.connections.add', {
      module: { type: moduleInfo.moduleId, product: moduleInfo.product },
      label,
      versionId: moduleInfo.versionId || moduleInfo.version,
    });
    if (typeof connectionId !== 'string' || !connectionId) throw new Error('Companion did not create the connection.');
    const state = await waitForConnectionEditState(rpc, connectionId);
    return {
      connectionId,
      label,
      moduleId: moduleInfo.moduleId,
      moduleVersionId: moduleInfo.versionId || moduleInfo.version,
      fields: state.fields || [],
      config: state.config || {},
      secrets: state.secrets || {},
      useNewLayout: state.useNewLayout !== false,
    };
  } catch (error) {
    if (connectionId) await rpc.mutate('instances.connections.delete', { connectionId }).catch(() => {});
    throw error;
  } finally { rpc.close(); }
}

export async function saveConnectionDraft(address, input) {
  const rpc = new CompanionRpcClient(address, { timeoutMs: 8000 });
  try {
    await rpc.connect();
    const error = await rpc.mutate('instances.connections.setConfig', {
      connectionId: input.connectionId,
      label: input.label,
      enabled: true,
      updatePolicy: 'manual',
      config: input.config || {},
      secrets: input.secrets || {},
    });
    if (error === 'invalid label') throw new Error(`The label “${input.label}” is invalid.`);
    if (error === 'duplicate label') throw new Error(`The label “${input.label}” is already in use.`);
    if (error) throw new Error(`Companion could not save the connection: ${error}`);
    return { saved: true, connectionId: input.connectionId };
  } finally { rpc.close(); }
}

export async function cancelConnectionDraft(address, connectionId) {
  const rpc = new CompanionRpcClient(address);
  try {
    await rpc.connect();
    await rpc.mutate('instances.connections.delete', { connectionId });
    return { deleted: true, connectionId };
  } finally { rpc.close(); }
}
async function addAction(rpc, controlId, connectionId, stepId, definition, setId = 'down') {
  const entityLocation = { stepId, setId };
  const entityId = await rpc.mutate('controls.entities.add', { controlId, entityLocation, ownerId: null, connectionId, entityType: 'action', entityDefinition: definition.definitionId });
  if (typeof entityId !== 'string') throw new Error(`Companion rejected action “${definition.definitionId}” on the selected module connection. Confirm that connection's configured device model exposes this action.`);
  for (const [key, value] of Object.entries(definition.options)) {
    await rpc.mutate('controls.entities.setOption', { controlId, entityLocation, entityId, key, value: { value, isExpression: false } });
  }
}

function hexColor(value, fallback) {
  const number = value?.value ?? value;
  return Number.isFinite(number) ? `#${Number(number).toString(16).padStart(6, '0').slice(-6)}` : fallback;
}

export function graphicsFrameSettled({ ready, lastUpdatedAt, now = Date.now(), settleMs = 180 }) {
  return Boolean(ready && lastUpdatedAt > 0 && now - lastUpdatedAt >= settleMs);
}

async function waitForSettledGraphics({ ready, lastUpdatedAt, timeoutMs = 1400, settleMs = 180 }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (graphicsFrameSettled({ ready: ready(), lastUpdatedAt: lastUpdatedAt(), settleMs })) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return ready();
}

function pageControlEntries(state, pageNumber) {
  if (state?.type !== 'init') return [];
  const pageId = state.order?.[pageNumber - 1];
  const controls = state.pages?.[pageId]?.controls || {};
  const result = [];
  for (const [row, columns] of Object.entries(controls)) {
    for (const [column, controlId] of Object.entries(columns || {})) {
      if (typeof controlId === 'string') result.push({ controlId, row: Number(row) + 1, column: Number(column) + 1 });
    }
  }
  return result;
}

export function summarizeControlActions(config) {
  const summaries = [];
  const seen = new Set();
  const labels = { mute: 'Channel mute', auxmute: 'Aux mute', cgmute: 'Control group mute', fader: 'Channel fader', snapshot: 'Snapshot', snapshotNext: 'Next snapshot', snapshotPrev: 'Previous snapshot', macros: 'Macro', set_page: 'Set page', pageup: 'Next page', pagedown: 'Previous page' };
  const walk = (value, path = []) => {
    if (!value || typeof value !== 'object') return;
    if (path.some((part) => /feedback/i.test(String(part)))) return;
    const definitionId = value.definitionId || value.entityDefinition || value.definition;
    const entityType = value.entityType || value.type;
    if (typeof definitionId === 'string' && (!entityType || entityType === 'action')) {
      const options = value.options || {};
      const stepPart = path.find((part, index) => /steps?/i.test(String(path[index - 1] || '')) || /^step/i.test(String(part)));
      const step = Number(String(stepPart || '').match(/\d+/)?.[0] || 0) + 1;
      const details = ['channel', 'mute', 'auxmute', 'cgmute', 'fader', 'snapshot', 'macro', 'page']
        .filter((key) => options[key] != null)
        .map((key) => `${key} ${options[key]?.value ?? options[key]}`);
      const summary = `Step ${step} · ${labels[definitionId] || definitionId}${details.length ? ` · ${details.join(', ')}` : ''}`;
      if (!seen.has(summary)) { seen.add(summary); summaries.push(summary); }
    }
    for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  };
  walk(config);
  return summaries;
}

export function extractControlActions(config) {
  const result = [];
  const seen = new Set();
  const walk = (value, path = []) => {
    if (!value || typeof value !== 'object' || path.some((part) => /feedback/i.test(String(part)))) return;
    const definitionId = value.definitionId || value.entityDefinition || value.definition;
    const entityType = value.entityType || value.type;
    if (typeof definitionId === 'string' && (!entityType || entityType === 'action')) {
      const options = Object.fromEntries(Object.entries(value.options || {}).map(([key, option]) => [key, option?.value ?? option]));
      const connectionId = value.connectionId || value.instanceId || value.instance;
      const stepPart = path.find((part, index) => /steps?/i.test(String(path[index - 1] || '')) || /^step/i.test(String(part)));
      const step = Number(String(stepPart || '').match(/\d+/)?.[0] || 0) + 1;
      const key = `${step}:${connectionId || ''}:${definitionId}:${JSON.stringify(options)}`;
      if (!seen.has(key)) { seen.add(key); result.push({ step, definitionId, options, ...(connectionId ? { connectionId } : {}) }); }
    }
    for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
  };
  walk(config);
  return result;
}

export async function discoverPageButtons(address, pageNumber) {
  const rpc = new CompanionRpcClient(address);
  let pageState = null;
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const entries = pageControlEntries(pageState, pageNumber);
    await Promise.all(entries.map(async (entry) => {
      let config = null;
      let render = null;
      let renderUpdatedAt = 0;
      const subscription = rpc.subscribe('controls.watchControl', { controlId: entry.controlId }, (event) => { if (event?.type === 'init') config = event.config; });
      const renderSubscription = rpc.subscribe('preview.graphics.location', { location: { pageNumber, row: entry.row - 1, column: entry.column - 1 } }, (event) => {
        if (event?.image) { render = event.image; renderUpdatedAt = Date.now(); }
      });
      await Promise.all([subscription.started, renderSubscription.started]);
      // Companion can emit a temporary black frame before text, feedbacks, and
      // images finish rendering at a newly moved location. Keep the subscription
      // alive until the latest frame has been quiet long enough to be final.
      await waitForSettledGraphics({ ready: () => Boolean(config && render), lastUpdatedAt: () => renderUpdatedAt });
      const layers = config?.style?.layers || [];
      const text = layers.find((layer) => layer.type === 'text' && (layer.usage === 'auto' || layer.id === 'text0'));
      const box = layers.find((layer) => layer.type === 'box' && (layer.usage === 'auto' || layer.id === 'box0'));
      entry.text = String(text?.text?.value || '').trim();
      entry.textColor = hexColor(text?.color, '#ffffff');
      entry.backgroundColor = hexColor(box?.color, '#202630');
      const rawTextSize = text?.fontsize?.value ?? text?.fontsize ?? text?.fontSize?.value ?? text?.fontSize ?? text?.size?.value ?? text?.size;
      entry.textSize = Number.isFinite(Number(rawTextSize)) ? Number(rawTextSize) : 'auto';
      entry.type = config?.type || 'button';
      entry.actions = summarizeControlActions(config);
      entry.programmedActions = extractControlActions(config);
      entry.image = typeof render === 'string' ? render : null;
      subscription.stop();
      renderSubscription.stop();
    }));
    return entries.map((entry) => ({ ...entry, row: entry.row - 1, column: entry.column - 1 }));
  } finally { rpc.close(); }
}

export async function discoverSurfaceButtonGraphics(address, surface, pageNumber) {
  const rpc = new CompanionRpcClient(address, { timeoutMs: 1500 });
  const graphics = new Map();
  const subscriptions = [];
  let graphicsUpdatedAt = 0;
  try {
    await rpc.connect();
    for (let row = 1; row <= surface.rows; row += 1) for (let column = 1; column <= surface.columns; column += 1) {
      const location = { pageNumber, row: surface.yOffset + row - 1, column: surface.xOffset + column - 1 };
      const subscription = rpc.subscribe('preview.graphics.location', { location }, (event) => {
        if (event?.image) {
          graphics.set(`${row}/${column}`, { row, column, image: event.image });
          graphicsUpdatedAt = Date.now();
        }
      });
      subscriptions.push(subscription);
    }
    await Promise.all(subscriptions.map((subscription) => subscription.started));
    await waitForSettledGraphics({
      ready: () => graphics.size >= surface.rows * surface.columns,
      lastUpdatedAt: () => graphicsUpdatedAt,
      timeoutMs: 1400,
    });
    return [...graphics.values()];
  } finally {
    for (const subscription of subscriptions) { try { subscription.stop(); } catch {} }
    rpc.close();
  }
}

export async function updateExistingButton(address, plan) {
  const rpc = new CompanionRpcClient(address);
  const location = companionLocation(plan.button.location);
  let pageState = null;
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const controlId = controlAt(pageState, location);
    if (!controlId) throw new Error(`No Companion button exists at ${plan.button.location.page}/${plan.button.location.row}/${plan.button.location.column}.`);
    const changes = plan.edit?.changes || {};
    if (changes.backgroundColor) await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'box0', key: 'color', value: { value: colorNumber(changes.backgroundColor), isExpression: false } });
    if (changes.text != null) await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'text', value: { value: fitButtonText(changes.text), isExpression: false } });
    if (changes.textColor) await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'color', value: { value: colorNumber(changes.textColor), isExpression: false } });
    if (changes.text != null || changes.textSize != null) {
      await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'fontsize', value: { value: changes.textSize === 'auto' || changes.textSize == null ? 100 : Number(changes.textSize), isExpression: false } });
      await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'fontsizeAllowShrink', value: { value: true, isExpression: false } });
    }
    const stateFeedback = toggleStateFeedbackDefinition(plan.button.appearance);
    if (stateFeedback && changes.visualToggle) {
      const feedbackId = await rpc.mutate('controls.entities.add', { controlId, entityLocation: 'feedbacks', ownerId: null, connectionId: stateFeedback.connectionId, entityType: 'feedback', entityDefinition: stateFeedback.definitionId });
      if (typeof feedbackId !== 'string') throw new Error('Companion could not update the toggle-step color feedback.');
      await rpc.mutate('controls.entities.setOption', { controlId, entityLocation: 'feedbacks', entityId: feedbackId, key: 'step', value: { value: stateFeedback.options.step, isExpression: false } });
      for (const override of stateFeedback.overrides) await rpc.mutate('controls.entities.replaceStyleOverride', { controlId, entityLocation: 'feedbacks', entityId: feedbackId, override });
    }
    return { updated: true, controlId, location, preserved: ['actions', 'feedbacks', 'steps'] };
  } finally { rpc.close(); }
}

export async function deleteSurfaceButton(address, surface, pageNumber, row, column) {
  const rpc = new CompanionRpcClient(address);
  try {
    await rpc.connect();
    const location = { pageNumber, row: surface.yOffset + row - 1, column: surface.xOffset + column - 1 };
    await rpc.mutate('controls.resetControl', { location });
    return { deleted: true, location };
  } finally { rpc.close(); }
}

export async function pressSurfaceButton(address, surface, pageNumber, row, column) {
  const rpc = new CompanionRpcClient(address);
  const location = { pageNumber, row: surface.yOffset + row - 1, column: surface.xOffset + column - 1 };
  try {
    await rpc.connect();
    await rpc.mutate('controls.hotPressControl', { location, direction: true, surfaceId: surface.id });
    // Match a real key press instead of issuing down/up in the same event turn.
    // Some modules dispatch their down action asynchronously and can otherwise
    // observe the release first or cancel held-action state before it starts.
    await new Promise((resolve) => setTimeout(resolve, 90));
    await rpc.mutate('controls.hotPressControl', { location, direction: false, surfaceId: surface.id });
    return { pressed: true, pageNumber, row, column, surfaceId: surface.id };
  } finally { rpc.close(); }
}

export async function moveExistingButton(address, plan) {
  const rpc = new CompanionRpcClient(address);
  const fromLocation = companionLocation(plan.move.from);
  const toLocation = companionLocation(plan.button.location);
  let pageState = null;
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    const sourceControlId = controlAt(pageState, fromLocation);
    if (!sourceControlId) throw new Error(`The source button at ${plan.move.from.page}/${plan.move.from.row}/${plan.move.from.column} no longer exists.`);
    if (controlAt(pageState, toLocation)) throw new Error(`The destination ${plan.button.location.page}/${plan.button.location.row}/${plan.button.location.column} is no longer empty.`);
    await rpc.mutate('controls.moveControl', { fromLocation, toLocation });
    await new Promise((resolve) => setTimeout(resolve, 120));
    let readback = moveReadbackStatus(await readFreshPageState(rpc), fromLocation, toLocation, sourceControlId);
    if (readback.status === 'moved') return { moved: true, location: toLocation, fromLocation, preserved: ['actions', 'feedbacks', 'steps', 'style'], transport: 'moveControl' };
    if (readback.status !== 'unchanged') throw new Error(`Companion move read-back failed (${readback.status}); the source was not deleted.`);

    // Some Companion surface locations acknowledge moveControl without changing
    // the page registry. Copy first, verify the destination, and only then clear
    // the original so a failed fallback can never lose the programmed control.
    const copied = await rpc.mutate('controls.copyControl', { fromLocation, toLocation });
    if (copied !== true) throw new Error('Companion acknowledged the move but did not create the destination control. The source was preserved.');
    await new Promise((resolve) => setTimeout(resolve, 120));
    readback = moveReadbackStatus(await readFreshPageState(rpc), fromLocation, toLocation, sourceControlId);
    if (!readback.destination || readback.source !== sourceControlId) throw new Error('Companion copy fallback could not verify both controls. The source was preserved.');
    await rpc.mutate('controls.resetControl', { location: fromLocation });
    await new Promise((resolve) => setTimeout(resolve, 120));
    readback = moveReadbackStatus(await readFreshPageState(rpc), fromLocation, toLocation, sourceControlId);
    if (readback.status !== 'moved') throw new Error('Companion created the destination but could not clear the source. Both controls were left visible for safety.');
    return { moved: true, location: toLocation, fromLocation, preserved: ['actions', 'feedbacks', 'steps', 'style'], transport: 'verified-copy-reset' };
  } finally { rpc.close(); }
}

export async function transferSurfaceButton(address, { sourceSurface, targetSurface, source, target, move = false }) {
  const rpc = new CompanionRpcClient(address);
  const fromLocation = { pageNumber: source.page, row: sourceSurface.yOffset + source.row - 1, column: sourceSurface.xOffset + source.column - 1 };
  const toLocation = { pageNumber: target.page, row: targetSurface.yOffset + target.row - 1, column: targetSurface.xOffset + target.column - 1 };
  let pageState = null;
  try {
    await rpc.connect();
    const pages = rpc.subscribe('pages.watch', undefined, (payload) => {
      for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event);
    });
    await pages.started;
    for (let attempt = 0; attempt < 80 && !pageState; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 25));
    if (!controlAt(pageState, fromLocation)) throw new Error(`The source button at ${source.page}/${source.row}/${source.column} no longer exists.`);
    if (controlAt(pageState, toLocation)) throw new Error(`The paste destination ${target.page}/${target.row}/${target.column} is not empty.`);
    const transferred = await rpc.mutate(move ? 'controls.moveControl' : 'controls.copyControl', { fromLocation, toLocation });
    if (transferred !== true) throw new Error(`Companion did not ${move ? 'move' : 'copy'} the button.`);
    return { transferred: true, moved: move, fromLocation, location: toLocation, preserved: ['actions', 'feedbacks', 'steps', 'style', 'graphics'] };
  } finally { rpc.close(); }
}

export async function deployPlan(plan, { address, connectionLabel = null, overwrite = false, targetSurface = null } = {}) {
  if (!plan?.module?.id || !plan?.module?.version) throw new Error('The button plan is missing its Companion module identity. Rebuild the preview and try again.');
  const rpc = new CompanionRpcClient(address);
  const location = companionLocation(plan.button.location);
  let pageState = null;
  const connections = [];
  let created = false;
  try {
    if (targetSurface) {
      const compatibility = surfaceCompatibility(targetSurface, plan.button.location);
      if (!compatibility.compatible) throw new Error(compatibility.reason);
    }
    await rpc.connect();
    const pagesSub = rpc.subscribe('pages.watch', undefined, (payload) => { for (const event of Array.isArray(payload) ? payload : [payload]) pageState = updatePages(pageState, event); });
    const connectionsSub = rpc.subscribe('instances.connections.watch', undefined, (payload) => connections.push(...(Array.isArray(payload) ? payload : [payload])));
    await Promise.all([pagesSub.started, connectionsSub.started]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (controlAt(pageState, location) && !overwrite) throw new Error(`Companion location page ${location.pageNumber}, row ${location.row + 1}, column ${location.column + 1} is not empty.`);
    const moduleId = plan.module.id === 'digico_osc' ? 'digico-osc' : plan.module.id;
    const connection = findModuleConnection(connections, moduleId, connectionLabel);
    if (!connection) throw new Error(connectionLabel ? `${moduleId} connection “${connectionLabel}” was not found.` : `No active ${moduleId} connection was found in Companion.`);
    if (connection.moduleVersionId !== plan.module.version) throw new Error(`The connected ${moduleId} version is ${connection.moduleVersionId}, not ${plan.module.version}.`);
    await rpc.mutate('controls.resetControl', { location, newType: 'button-layered' });
    created = true;
    for (let attempt = 0; attempt < 20 && !controlAt(pageState, location); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 50));
    const controlId = controlAt(pageState, location);
    if (!controlId) throw new Error('Companion created the button but did not return its control identifier.');
    const isPhysicalEncoder = targetSurface && surfaceRotaryLocations(targetSurface).some(({ row, column }) =>
      location.row === row + targetSurface.yOffset - 1 && location.column === column + targetSurface.xOffset - 1
    );
    if (isPhysicalEncoder) await rpc.mutate('controls.setOptionsField', { controlId, key: 'rotaryActions', value: true });
    const definitions = actionDefinitions(plan.button.action);
    if (plan.button.action.operation === 'momentary-cc') {
      for (const definition of definitions.filter((item) => item.phase === 'press')) await addAction(rpc, controlId, connection.id, '0', definition, 'down');
      for (const definition of definitions.filter((item) => item.phase === 'release')) await addAction(rpc, controlId, connection.id, '0', definition, 'up');
    } else if (plan.button.action.operation === 'toggle-mute') {
      for (const definition of definitions) await addAction(rpc, controlId, connection.id, '0', { ...definition, options: { ...definition.options, [definition.definitionId]: '1' } });
      const secondStep = await rpc.mutate('controls.steps.add', { controlId });
      for (const definition of definitions) await addAction(rpc, controlId, connection.id, String(secondStep), { ...definition, options: { ...definition.options, [definition.definitionId]: '0' } });
    } else if (plan.button.appearance?.states) {
      for (const definition of definitions) await addAction(rpc, controlId, connection.id, '0', definition);
      const secondStep = await rpc.mutate('controls.steps.add', { controlId });
      for (const definition of definitions) await addAction(rpc, controlId, connection.id, String(secondStep), definition);
    } else for (const definition of definitions) await addAction(rpc, controlId, connection.id, '0', definition);
    await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'box0', key: 'color', value: { value: colorNumber(plan.button.appearance.backgroundColor), isExpression: false } });
    await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'text', value: { value: resolvedButtonText(plan, connection.label), isExpression: false } });
    await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'color', value: { value: colorNumber(plan.button.appearance.textColor), isExpression: false } });
    // Companion's layered-button schema uses `fontsize`, not `size`. Starting at
    // its full scale and enabling shrink preserves whole words such as STOP while
    // allowing longer labels to fit the physical key automatically.
    await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'fontsize', value: { value: plan.button.appearance.textSize === 'auto' || plan.button.appearance.textSize == null ? 100 : Number(plan.button.appearance.textSize), isExpression: false } });
    await rpc.mutate('controls.styles.updateOption', { controlId, elementId: 'text0', key: 'fontsizeAllowShrink', value: { value: true, isExpression: false } });
    const stateFeedback = toggleStateFeedbackDefinition(plan.button.appearance);
    if (stateFeedback) {
      const feedbackId = await rpc.mutate('controls.entities.add', { controlId, entityLocation: 'feedbacks', ownerId: null, connectionId: stateFeedback.connectionId, entityType: 'feedback', entityDefinition: stateFeedback.definitionId });
      if (typeof feedbackId !== 'string') throw new Error('Companion could not create the toggle-step color feedback.');
      await rpc.mutate('controls.entities.setOption', { controlId, entityLocation: 'feedbacks', entityId: feedbackId, key: 'step', value: { value: stateFeedback.options.step, isExpression: false } });
      for (const override of stateFeedback.overrides) {
        await rpc.mutate('controls.entities.replaceStyleOverride', { controlId, entityLocation: 'feedbacks', entityId: feedbackId, override });
      }
    }
    return { deployed: true, controlId, connection: connection.label, location };
  } catch (error) {
    if (created) await rpc.mutate('controls.resetControl', { location }).catch(() => {});
    throw error;
  } finally { rpc.close(); }
}

export async function clearPlanLocations(address, plans) {
  const rpc = new CompanionRpcClient(address);
  try {
    await rpc.connect();
    for (const plan of plans) await rpc.mutate('controls.resetControl', { location: companionLocation(plan.button.location) });
  } finally { rpc.close(); }
}
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
