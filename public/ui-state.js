import { resolveCompanionGraphic } from './appearance.js';

export function moveRefreshPages(sourcePage, targetPage) {
  const target = Number(targetPage);
  const source = Number(sourcePage);
  const pages = [];
  if (Number.isInteger(target) && target > 0) pages.push(target);
  if (Number.isInteger(source) && source > 0 && source !== target) pages.push(source);
  return pages;
}

export function quickPreviewChangeAffectsTypography(controlId) {
  return controlId === 'quick-button-text' || controlId === 'quick-text-size';
}

export function previewDispositionAfterDeploy(planKinds) {
  const kinds = Array.isArray(planKinds) ? planKinds : [planKinds];
  return kinds.length && kinds.every((kind) => ['create-button', 'edit-button', 'replace-button'].includes(kind)) ? 'clear' : 'retain';
}

export function toggleWorkspaceSurfaceSelection(selectedIds, surfaceId, checked, activeId = '') {
  const selected = new Set(selectedIds || []);
  if (checked) selected.add(surfaceId);
  else selected.delete(surfaceId);
  const nextActiveId = activeId && selected.has(activeId)
    ? activeId
    : checked && selected.has(surfaceId)
      ? surfaceId
      : [...selected][0] || '';
  return { selectedIds: [...selected], nextActiveId };
}

export function resolvePlanTargetSurface(surfaces, plans, preferredSurfaceId = '') {
  const candidates = (surfaces || []).filter((surface) => surface && !surface.offline && surface.connected !== false);
  const requested = (plans || []).map((plan) => plan?.button?.location).filter(Boolean);
  if (!requested.length) return null;
  const compatible = candidates.filter((surface) => requested.every((location) => (
    location.row >= Number(surface.yOffset || 0)
    && location.row < Number(surface.yOffset || 0) + Number(surface.rows || 0)
    && location.column >= Number(surface.xOffset || 0)
    && location.column < Number(surface.xOffset || 0) + Number(surface.columns || 0)
  )));
  return compatible.find((surface) => surface.id === preferredSurfaceId) || compatible[0] || null;
}

export function fitsSurfaceGrid(surface, location, { local = false } = {}) {
  if (!surface || !location) return false;
  const rowStart = local ? 0 : Number(surface.yOffset || 0);
  const columnStart = local ? 0 : Number(surface.xOffset || 0);
  return Number(location.row) >= rowStart
    && Number(location.row) < rowStart + Number(surface.rows || 0)
    && Number(location.column) >= columnStart
    && Number(location.column) < columnStart + Number(surface.columns || 0);
}

export function findPlanAtLocation(plans, location) {
  if (!location) return null;
  return (plans || []).find((plan) => plan?.button?.location?.page === location.page
    && plan.button.location.row === location.row
    && plan.button.location.column === location.column) || null;
}

export function firstOpenSurfaceLocation(surface, page, occupied = []) {
  if (!surface || !Number.isInteger(Number(page)) || Number(page) < 1) return null;
  const taken = new Set((occupied || []).map((item) => {
    const location = item?.button?.location || item;
    return location ? `${Number(location.page ?? page)}/${Number(location.row)}/${Number(location.column)}` : '';
  }));
  const rowStart = Number(surface.yOffset || 0);
  const columnStart = Number(surface.xOffset || 0);
  for (let row = rowStart; row < rowStart + Number(surface.rows || 0); row += 1) {
    for (let column = columnStart; column < columnStart + Number(surface.columns || 0); column += 1) {
      const location = { page: Number(page), row, column };
      if (!taken.has(`${location.page}/${row}/${column}`)) return location;
    }
  }
  return null;
}

export function companionStartupPolicy(surfaces, { previouslyHadOnlineSurface = false, selectedDuringSwitch = false } = {}) {
  const online = (surfaces || []).filter((surface) => surface.connected !== false);
  const satelliteNetworkMode = online.some((surface) => surface.satellite);
  const satelliteStartupOffline = satelliteNetworkMode && !previouslyHadOnlineSurface && !selectedDuringSwitch;
  return {
    satelliteNetworkMode,
    satelliteStartupOffline,
    autoPromptStartupSync: !satelliteNetworkMode,
    enrollOnlineSurfacesAutomatically: !satelliteNetworkMode,
  };
}

export function createGraphicFrameRegistry() {
  const verifiedByControl = new Map();
  const rejectedFrames = new Set();
  return {
    resolve(controlId, candidate) {
      const knownBlank = rejectedFrames.has(candidate);
      return {
        knownBlank,
        graphic: resolveCompanionGraphic(candidate, {
          blank: knownBlank,
          verified: controlId ? verifiedByControl.get(controlId) : null,
        }),
      };
    },
    record(controlId, candidate, { blank }) {
      if (blank) rejectedFrames.add(candidate);
      else {
        rejectedFrames.delete(candidate);
        if (controlId) verifiedByControl.set(controlId, candidate);
      }
      return resolveCompanionGraphic(candidate, {
        blank,
        verified: controlId ? verifiedByControl.get(controlId) : null,
      });
    },
  };
}
