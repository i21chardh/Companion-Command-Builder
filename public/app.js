const MODELS = Object.freeze({
  mini: { name: 'Stream Deck Mini', columns: 3, rows: 2 },
  neo: { name: 'Stream Deck Neo', columns: 4, rows: 2 },
  mk2: { name: 'Stream Deck / MK.2', columns: 5, rows: 3 },
  '4x4': { name: 'Stream Deck 4×4', columns: 4, rows: 4 },
  plus: { name: 'Stream Deck +', columns: 4, rows: 2 },
  'plus-xl': { name: 'Stream Deck + XL', columns: 6, rows: 6 },
  xl: { name: 'Stream Deck XL', columns: 8, rows: 4 },
  studio: { name: 'Stream Deck Studio', columns: 16, rows: 2 },
});

const form = document.querySelector('#command-form');
const command = document.querySelector('#command');
const targetModuleSelect = document.querySelector('#target-module');
const clearTargetModuleButton = document.querySelector('#clear-target-module');
const targetModuleNote = document.querySelector('#target-module-note');
const buttonGraphicSelect = document.querySelector('#button-graphic');
const buttonGraphicNote = document.querySelector('#button-graphic-note');
const modelSelect = document.querySelector('#surface-model');
const deviceSelect = document.querySelector('#online-device');
const pageInput = document.querySelector('#page-number');
const previousPageButton = document.querySelector('#previous-page');
const nextPageButton = document.querySelector('#next-page');
const deviceLayerSelect = document.querySelector('#device-layer');
const addDeviceLayerButton = document.querySelector('#add-device-layer');
const removeDeviceLayerButton = document.querySelector('#remove-device-layer');
const layerEdgeLeft = document.querySelector('#layer-edge-left');
const layerEdgeRight = document.querySelector('#layer-edge-right');
const addressInput = document.querySelector('#companion-address');
const status = document.querySelector('#connection-status');
const empty = document.querySelector('#empty-state');
const result = document.querySelector('#result');
const error = document.querySelector('#error');
const validation = document.querySelector('#validation');
const aiEnabled = document.querySelector('#ai-enabled');
const aiOnlineStatus = document.querySelector('#ai-online-status');
const dictateButton = document.querySelector('#dictate-button');
const audioInputSelect = document.querySelector('#audio-input-device');
const audioInputChannelSelect = document.querySelector('#audio-input-channel');
const refreshAudioInputsButton = document.querySelector('#refresh-audio-inputs');
const audioMeterLevel = document.querySelector('#audio-meter-level');
const audioMeterStatus = document.querySelector('#audio-meter-status');
let audioMeterSession = null;
let activeButtonGraphics = {};
let activeConnections = [];
const connectionNetworkCache = new Map();
let knownModuleIds = [];
let disabledModuleIds = new Set();
try { disabledModuleIds = new Set(JSON.parse(localStorage.getItem('ccb-disabled-modules') || '[]')); } catch {}
let currentPlan = null;
let currentPlans = [];
let previewBasePlans = [];
let pendingButtonPreview = false;
let previewToggleState = 'unmuted';
let companionOnline = false;
let connectedSurfaces = [];
let connectionCheckRunning = false;
let existingButtons = [];
let existingButtonsPage = 1;
let lastButtonsRefresh = 0;
let buttonGraphicsRefreshRunning = false;
let useOfflineTemplate = localStorage.getItem('use-offline-template') === 'true';
let offlineWorkspaceExplicitlyActivated = false;
let deviceLayerCounter = 1;
let deviceLayers = [{ id: 'layout-1', name: 'Deck layout 1', page: 1, model: modelSelect.value, deviceId: '', plans: [] }];
let activeDeviceLayerId = 'layout-1';
let devicePlanCache = {};
let activeDragPayload = null;
let layerEdgeTimer = null;
let crossLayerDragArmed = false;
let selectedGridItem = null;
let buttonClipboard = null;
let testButtonsMode = false;
const offlineGridToggleStates = new Map();
let layoutSourceActivated = false;
let deviceSwitchInProgress = false;
let deviceSwitchTargetId = '';
const deployButton = document.querySelector('#deploy-button');
const deployStatus = document.querySelector('#deploy-status');
const syncFromDeviceButton = document.querySelector('#sync-from-device');
const clearDevicePageButton = document.querySelector('#clear-device-page');
const addLayerScrollButton = document.querySelector('#add-layer-scroll');
const initializeEncodersButton = document.querySelector('#initialize-encoders');
const deleteSelectedButton = document.querySelector('#delete-selected-button');
const cutSelectedButton = document.querySelector('#cut-selected-button');
const testButtonsModeButton = document.querySelector('#test-buttons-mode');
const copySelectedButton = document.querySelector('#copy-selected-button');
const pasteButton = document.querySelector('#paste-button');
const confirmAddButton = document.querySelector('#confirm-add-button');
const updatePreviewButton = document.querySelector('#update-preview-button');
const selectedButtonSummary = document.querySelector('#selected-button-summary');
const mergeDeviceLayoutButton = document.querySelector('#merge-device-layout');
const overwriteDeviceLayoutButton = document.querySelector('#overwrite-device-layout');
const savePresetButton = document.querySelector('#save-preset');
const savePresetAsButton = document.querySelector('#save-preset-as');
const loadPresetButton = document.querySelector('#load-preset');
const presetFileInput = document.querySelector('#preset-file-input');
const deviceSyncDialog = document.querySelector('#device-sync-dialog');
const connectionWizardDialog = document.querySelector('#connection-wizard-dialog');
const connectionWizardForm = document.querySelector('#connection-wizard-form');
const connectionWizardFields = document.querySelector('#connection-wizard-fields');
const connectionWizardReview = document.querySelector('#connection-wizard-review');
const connectionWizardConfirm = document.querySelector('#connection-wizard-confirm');
const refreshConnectionInventoryButton = document.querySelector('#refresh-connection-inventory');
const toggleConnectionRegistryButton = document.querySelector('#toggle-connection-registry');
const connectionRegistrySection = document.querySelector('.connection-registry');
const supportProgressDialog = document.querySelector('#support-progress-dialog');
const supportProgressFill = document.querySelector('#support-progress-fill');
const supportProgressStage = document.querySelector('#support-progress-stage');
const supportProgressPercent = document.querySelector('#support-progress-percent');
const supportProgressSummary = document.querySelector('#support-progress-summary');
const supportProgressClose = document.querySelector('#support-progress-close');
let connectionDraft = null;
const satelliteAddressInput = document.querySelector('#satellite-address');
const openSatelliteButton = document.querySelector('#open-satellite');
const satelliteStatus = document.querySelector('#satellite-status');
const oscTestStatus = document.querySelector('#osc-test-status');
const oscTestPort = document.querySelector('#osc-test-port');
const oscTestToggle = document.querySelector('#osc-test-toggle');
const oscTestApplyPort = document.querySelector('#osc-test-apply-port');
const oscTestSelf = document.querySelector('#osc-test-self');
const oscTestClear = document.querySelector('#osc-test-clear');
const oscTestCount = document.querySelector('#osc-test-count');
const oscTestLog = document.querySelector('#osc-test-log');
const quickButtonEditor = document.querySelector('#quick-button-editor');
const quickButtonText = document.querySelector('#quick-button-text');
const quickTextColor = document.querySelector('#quick-text-color');
const quickBackgroundColor = document.querySelector('#quick-background-color');
const quickTextColorValue = document.querySelector('#quick-text-color-value');
const quickBackgroundColorValue = document.querySelector('#quick-background-color-value');
const quickStateNote = document.querySelector('#quick-state-note');
const quickTextSize = document.querySelector('#quick-text-size');
const quickEditApply = document.querySelector('#quick-edit-apply');
let quickPreviewExactSource = null;
let quickPreviewRecolorToken = 0;
const workspacePicker = document.querySelector('#workspace-device-picker');
const workspaceDeviceOptions = document.querySelector('#workspace-device-options');
const workspaceDeviceSummary = document.querySelector('#workspace-device-summary');
const workspaceSurfaces = document.querySelector('#workspace-surfaces');
const activeWorkspaceName = document.querySelector('#active-workspace-name');
const toggleWorkspaceViewButton = document.querySelector('#toggle-workspace-view');
const systemLogPanel = document.querySelector('#system-log-panel');
const systemLogSummary = document.querySelector('#system-log-summary');
const systemLogPath = document.querySelector('#system-log-path');
const systemLogContent = document.querySelector('#system-log-content');
const refreshSystemLogButton = document.querySelector('#refresh-system-log');
const copySystemLogButton = document.querySelector('#copy-system-log');
const openSystemLogButton = document.querySelector('#open-system-log');
const clearSystemLogButton = document.querySelector('#clear-system-log');
let presetFileHandle = localStorage.getItem('ccb-preset-path')
  ? { path: localStorage.getItem('ccb-preset-path'), name: localStorage.getItem('ccb-preset-name') || 'Companion-Layout.ccb-layout' }
  : null;
let presetBrowserFileHandle = null;
let sessionDirty = false;
const savedWorkspaceSurfaceIds = localStorage.getItem('ccb-workspace-surfaces');
let workspaceSurfaceIds = new Set();
try { workspaceSurfaceIds = new Set(JSON.parse(savedWorkspaceSurfaceIds || '[]')); } catch {}
const workspaceButtonCache = new Map();
let workspacePendingSelectionId = '';
let deviceSwitchPromptRequested = false;
let startupSurfaceSyncInitialized = false;
let startupSurfaceSyncQueue = [];
let workspaceViewEnabled = localStorage.getItem('ccb-workspace-view') !== 'false';
let workspacePages = {};
try { workspacePages = JSON.parse(localStorage.getItem('ccb-workspace-pages') || '{}'); } catch {}

async function reportBrowserError(event, message, stack = '', context = {}) {
  try {
    await fetch('/api/system-log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ level: 'error', event, message, stack, context: { ...context, page: location.pathname, online: companionOnline, surfaceId: deviceSelect.value || null } }) });
  } catch {}
}

window.addEventListener('error', (event) => {
  reportBrowserError('browser-uncaught-error', event.message, event.error?.stack || '', { source: event.filename, line: event.lineno, column: event.colno });
});
window.addEventListener('unhandledrejection', (event) => {
  reportBrowserError('browser-unhandled-rejection', event.reason?.message || String(event.reason), event.reason?.stack || '');
});

async function refreshSystemLog() {
  systemLogSummary.textContent = 'Loading diagnostics…';
  try {
    const response = await fetch('/api/system-log?lines=500');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'System log unavailable.');
    systemLogPath.textContent = data.path;
    systemLogContent.textContent = data.content || 'No diagnostic entries yet.';
    systemLogSummary.textContent = data.content ? `${data.content.split('\n').length} recent entries` : 'No errors recorded';
    systemLogContent.scrollTop = systemLogContent.scrollHeight;
  } catch (problem) {
    systemLogSummary.textContent = 'Unable to load diagnostics';
    systemLogContent.textContent = problem.message;
  }
}

systemLogPanel.addEventListener('toggle', () => { if (systemLogPanel.open) refreshSystemLog(); });
refreshSystemLogButton.addEventListener('click', refreshSystemLog);
copySystemLogButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(systemLogContent.textContent || '');
  systemLogSummary.textContent = 'Copied to clipboard';
});
openSystemLogButton.addEventListener('click', async () => {
  const response = await fetch('/api/system-log/open', { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not open the log location.');
  systemLogPath.textContent = data.path;
});
clearSystemLogButton.addEventListener('click', async () => {
  if (!window.confirm('Clear the System Log? The current diagnostic history will be removed.')) return;
  const response = await fetch('/api/system-log', { method: 'DELETE' });
  if (!response.ok) throw new Error('Could not clear the System Log.');
  await refreshSystemLog();
});

function setSessionDirty(dirty) {
  sessionDirty = dirty;
  savePresetButton.textContent = dirty ? 'Save *' : 'Save';
  savePresetButton.title = dirty ? 'Current session has unsaved changes' : 'Current session is saved';
}

function saveCurrentSession() {
  if (!deviceSelect.value) saveActiveDeviceLayer();
  const session = {
    format: 'companion-command-builder-session', schemaVersion: 1, savedAt: new Date().toISOString(),
    command: command.value, model: modelSelect.value, useOfflineTemplate, activeDeviceLayerId, targetModuleId: targetModuleSelect.value || '',
    deviceLayers: structuredClone(deviceLayers), devicePlanCache: structuredClone(devicePlanCache),
    selectedDeviceId: deviceSelect.value || '', selectedPage: viewedPage(), selectedGraphic: buttonGraphicSelect.value || '',
  };
  localStorage.setItem('companion-command-builder-saved-session-v1', JSON.stringify(session));
  setSessionDirty(false);
  deployStatus.textContent = `Current Builder session saved locally at ${new Date().toLocaleTimeString()}.`;
  deployStatus.style.color = 'var(--lime)';
}

function gridItemKey(type, page, row, column) { return `${type}:${page}:${row}:${column}`; }
function gridLocationKey(page, row, column) { return `${page}/${row}/${column}`; }

function toggleOfflineGridButton(plan) {
  if (!plan?.button?.appearance?.states) {
    deployStatus.textContent = 'Offline simulation cannot execute module actions. Connect a Companion device to fire this button.';
    deployStatus.style.color = 'var(--cyan)';
    return;
  }
  const location = plan.button.location;
  const key = gridLocationKey(location.page, location.row, location.column);
  const next = offlineGridToggleStates.get(key) === 'muted' ? 'unmuted' : 'muted';
  offlineGridToggleStates.set(key, next);
  deployStatus.textContent = `Offline visual simulation · ${location.page}/${location.row}/${location.column} · ${next} state. Actions were not sent.`;
  deployStatus.style.color = 'var(--cyan)';
  renderSurface();
}

function updateTestButtonsMode() {
  const online = Boolean(companionOnline && selectedSurface()?.id && !selectedSurface()?.offline);
  testButtonsModeButton.textContent = `${online ? '▶ Test Buttons' : '◐ Simulate Buttons'}: ${testButtonsMode ? 'On' : 'Off'}`;
  testButtonsModeButton.setAttribute('aria-pressed', String(testButtonsMode));
  testButtonsModeButton.classList.toggle('active', testButtonsMode);
}
function selectGridItem(item) {
  selectedGridItem = item;
  deleteSelectedButton.disabled = !item || item.type === 'empty';
  deleteSelectedButton.textContent = item && item.type !== 'empty' ? `Delete ${item.page}/${item.row}/${item.column}` : 'Delete Selected';
  const hasButton = Boolean(item && item.type !== 'empty');
  cutSelectedButton.disabled = !hasButton;
  copySelectedButton.disabled = !hasButton;
  pasteButton.disabled = !(buttonClipboard && item?.type === 'empty');
  if (hasButton) loadSelectedButtonIntoPreview(item);
  else quickButtonEditor.classList.add('hidden');
  renderSurface();
}

function selectedButtonSource(item = selectedGridItem) {
  if (!item || item.type === 'empty') return null;
  const planned = findPlanAtLocation(surfacePlans(), item);
  const existing = item.existing || existingButtons.find((button) => button.row === item.row && button.column === item.column);
  const appearance = planned?.button?.appearance?.states?.unmuted || planned?.button?.appearance || existing || {};
  return {
    item, planned, existing,
    text: planned?.button?.text ?? existing?.text ?? 'BUTTON',
    textColor: appearance.textColor || '#ffffff', backgroundColor: appearance.backgroundColor || '#202630',
    textSize: appearance.textSize ?? existing?.textSize ?? 'auto',
    image: existing?.image || null,
    actions: planned?.actions || (existing?.actions || []).map((summary, index) => ({ step: index + 1, summary, actionId: existing?.programmedActions?.[index]?.definitionId || 'existing' })),
  };
}

const companionGraphicProbe = document.createElement('canvas');
companionGraphicProbe.width = 48;
companionGraphicProbe.height = 48;
const companionGraphicFrames = createGraphicFrameRegistry();

function companionGraphicIsBlank(image) {
  try {
    const context = companionGraphicProbe.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, companionGraphicProbe.width, companionGraphicProbe.height);
    context.drawImage(image, 0, 0, companionGraphicProbe.width, companionGraphicProbe.height);
    return rgbaFrameLooksBlank(context.getImageData(0, 0, companionGraphicProbe.width, companionGraphicProbe.height).data);
  } catch { return false; }
}

function showGridTextFallback(key, label) {
  key.replaceChildren();
  key.textContent = label;
  key.classList.remove('exact-render-location');
  key.classList.add('graphic-text-fallback');
}

function installGridGraphic(key, source, label, { exactLocation = false, controlId = '', allowVerifiedFallback = true } = {}) {
  const known = allowVerifiedFallback ? companionGraphicFrames.resolve(controlId, source) : { knownBlank: false, graphic: source };
  if (known.knownBlank) {
    if (known.graphic && known.graphic !== source) {
      installGridGraphic(key, known.graphic, label, { exactLocation, controlId, allowVerifiedFallback: false });
      key.classList.add('verified-graphic-fallback');
    } else if (String(label || '').trim()) showGridTextFallback(key, label);
    return;
  }
  const image = document.createElement('img');
  image.alt = label || 'Companion button';
  image.addEventListener('load', () => {
    if (!key.contains(image)) return;
    const blank = companionGraphicIsBlank(image);
    const resolved = companionGraphicFrames.record(controlId, source, { blank });
    if (!blank) return;
    if (resolved && resolved !== source) {
      installGridGraphic(key, resolved, label, { exactLocation, controlId, allowVerifiedFallback: false });
      key.classList.add('verified-graphic-fallback');
      return;
    }
    if (!String(label || '').trim()) return;
    showGridTextFallback(key, label);
  }, { once: true });
  image.src = source;
  key.replaceChildren(image);
  if (exactLocation) key.classList.add('exact-render-location');
}

function ensureTextSizeChoice(value) {
  const normalized = String(value ?? 'auto');
  if (![...quickTextSize.options].some((option) => option.value === normalized)) quickTextSize.append(new Option(`${normalized}% · current`, normalized));
  quickTextSize.value = normalized;
}

function previewTextLayout(text, requestedSize = 'auto') {
  const paragraphs = String(text || 'BUTTON').split('\n');
  const previewKeySize = 118;
  const usableWidth = 104;
  // The preview reserves its top band for the authoritative CCB grid address in
  // both exact and simulated modes. Keeping the same content rectangle prevents
  // a color edit from changing text scale merely because the exact image hides.
  const hasLocationBand = Boolean(document.querySelector('#deck-button')?.dataset.ccbLocation);
  const usableHeight = hasLocationBand ? 76 : 104;
  // Companion's fontsize is a percentage of the key height. `auto` is CCB's
  // shorthand for Companion's 100% plus fontsizeAllowShrink=true.
  const requestedPercent = companionSafeFontPercent(text, requestedSize);
  let low = 6;
  let high = previewKeySize * requestedPercent / 100;
  const canvas = previewTextLayout.canvas ||= document.createElement('canvas');
  const context = canvas.getContext('2d');
  const wrap = (size) => {
    context.font = `700 ${size}px Inter, sans-serif`;
    return paragraphs.flatMap((paragraph) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [''];
      const lines = [];
      let line = words[0];
      for (const word of words.slice(1)) {
        const candidate = `${line} ${word}`;
        if (context.measureText(candidate).width <= usableWidth) line = candidate;
        else { lines.push(line); line = word; }
      }
      lines.push(line);
      return lines;
    });
  };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = (low + high) / 2;
    context.font = `700 ${candidate}px Inter, sans-serif`;
    const lines = wrap(candidate);
    const widest = Math.max(...lines.map((line) => context.measureText(line || ' ').width));
    const totalHeight = candidate * .98 * lines.length;
    if (widest <= usableWidth && totalHeight <= usableHeight) low = candidate;
    else high = candidate;
  }
  const size = Math.max(6, Math.floor(low));
  return { size, lines: wrap(size), companionPercent: requestedPercent };
}

function fittedPreviewFontSize(text, requestedSize = 'auto') {
  return previewTextLayout(text, requestedSize).size;
}

function setQuickPreviewTypography(text, requestedSize = 'auto') {
  const layout = previewTextLayout(text, requestedSize);
  const channel = document.querySelector('#button-channel');
  channel.textContent = layout.lines.join('\n');
  channel.style.fontSize = `${layout.size}px`;
  channel.style.lineHeight = '.98';
  channel.dataset.typographyReady = 'true';
  quickTextSize.dataset.deploymentValue = String(layout.companionPercent);
  return layout;
}

async function paintExactQuickColorPreview() {
  const source = quickPreviewExactSource;
  if (!source?.image || quickButtonText.value !== source.text || String(quickTextSize.value) !== String(source.textSize)) return false;
  const token = ++quickPreviewRecolorToken;
  const image = new Image();
  image.src = source.image;
  try { await image.decode(); } catch { return false; }
  if (token !== quickPreviewRecolorToken || !image.naturalWidth || !image.naturalHeight) return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    frame.data.set(recolorCompanionFrame(frame.data, {
      sourceTextColor: source.textColor,
      sourceBackgroundColor: source.backgroundColor,
      targetTextColor: quickTextColor.value,
      targetBackgroundColor: quickBackgroundColor.value,
    }));
    context.putImageData(frame, 0, 0);
    if (token !== quickPreviewRecolorToken) return false;
    const previewKey = document.querySelector('#deck-button');
    const rendered = document.querySelector('#button-render');
    rendered.src = canvas.toDataURL('image/png');
    rendered.classList.remove('hidden');
    previewKey.classList.remove('quick-simulated');
    previewKey.classList.add('exact-render');
    return true;
  } catch { return false; }
}

function paintQuickPreview({ preserveTypography = false } = {}) {
  const previewKey = document.querySelector('#deck-button');
  quickTextColorValue.textContent = quickTextColor.value.toLowerCase();
  quickBackgroundColorValue.textContent = quickBackgroundColor.value.toLowerCase();
  if (preserveTypography && quickPreviewExactSource?.image && quickButtonText.value === quickPreviewExactSource.text && String(quickTextSize.value) === String(quickPreviewExactSource.textSize)) {
    paintExactQuickColorPreview();
    return;
  }
  quickPreviewRecolorToken += 1;
  previewKey.classList.remove('exact-render');
  previewKey.classList.add('quick-simulated');
  document.querySelector('#button-render').classList.add('hidden');
  previewKey.style.background = quickBackgroundColor.value;
  previewKey.style.color = quickTextColor.value;
  // Companion's default layered button is a 100%-opacity box with no border,
  // shadow, or glow. Decorative preview effects made identical hex values look
  // darker or more saturated than the deployed key.
  previewKey.style.borderColor = 'transparent';
  previewKey.style.boxShadow = 'none';
  const text = quickButtonText.value || 'BUTTON';
  const channel = document.querySelector('#button-channel');
  if (!preserveTypography || channel.dataset.typographyReady !== 'true') setQuickPreviewTypography(text, quickTextSize.value);
  const action = document.querySelector('#button-action');
  action.textContent = '';
  action.style.fontSize = '';
}

function removeAppliedGraphic(text, graphic) {
  if (!graphic?.symbol) return String(text || '');
  const value = String(text || '');
  if (value.startsWith(`${graphic.symbol}\n`)) return value.slice(graphic.symbol.length + 1);
  if (value.startsWith(graphic.symbol)) return value.slice(graphic.symbol.length).replace(/^\s+/, '');
  return value;
}

function applyPreviewGraphicSelection() {
  const graphic = activeButtonGraphics[buttonGraphicSelect.value] || null;
  const source = selectedButtonSource();
  if (source && !quickButtonEditor.classList.contains('hidden')) {
    const previous = source.planned?.button?.graphic || activeButtonGraphics[source.item?.graphicId] || null;
    const base = removeAppliedGraphic(quickButtonText.value, previous);
    quickButtonText.value = graphic ? `${graphic.symbol}\n${base}` : base;
    if (source.item) source.item.graphicId = buttonGraphicSelect.value;
    if (source.planned?.button) {
      source.planned.button.graphic = graphic ? { id: buttonGraphicSelect.value, symbol: graphic.symbol, label: graphic.label } : null;
      source.planned.button.text = quickButtonText.value;
      currentPlan = source.planned;
      saveActiveDeviceLayer();
    }
    paintQuickPreview();
  } else if (currentPlan?.button) {
    const base = removeAppliedGraphic(currentPlan.button.text, currentPlan.button.graphic);
    currentPlan.button.graphic = graphic ? { id: buttonGraphicSelect.value, symbol: graphic.symbol, label: graphic.label } : null;
    currentPlan.button.text = graphic ? `${graphic.symbol}\n${base}` : base;
    currentPlan.button.appearance.textSize = companionSafeFontPercent(currentPlan.button.text, currentPlan.button.appearance.requestedTextSize ?? currentPlan.button.appearance.textSize ?? 'auto');
    if (!quickButtonEditor.classList.contains('hidden')) quickButtonText.value = currentPlan.button.text;
    const channel = document.querySelector('#button-channel');
    const layout = previewTextLayout(currentPlan.button.text, currentPlan.button.appearance?.textSize ?? 'auto');
    channel.textContent = layout.lines.join('\n');
    channel.style.fontSize = `${layout.size}px`;
    document.querySelector('#button-action').textContent = '';
    document.querySelector('#button-render').classList.add('hidden');
    document.querySelector('#deck-button').classList.remove('exact-render');
    if (!quickButtonEditor.classList.contains('hidden')) paintQuickPreview();
    saveActiveDeviceLayer();
    renderBatchList();
    renderSurface();
  }
  localStorage.setItem('button-graphic', buttonGraphicSelect.value);
  setSessionDirty(true);
}

function loadSelectedButtonIntoPreview(item) {
  const source = selectedButtonSource(item);
  if (!source) return;
  const inferredGraphicId = source.planned?.button?.graphic?.id
    || Object.entries(activeButtonGraphics).find(([, graphic]) => source.text.startsWith(`${graphic.symbol}\n`) || source.text.startsWith(graphic.symbol))?.[0]
    || '';
  buttonGraphicSelect.value = [...buttonGraphicSelect.options].some((option) => option.value === inferredGraphicId) ? inferredGraphicId : '';
  item.graphicId = buttonGraphicSelect.value;
  quickButtonText.value = source.text;
  quickTextColor.value = source.textColor;
  quickBackgroundColor.value = source.backgroundColor;
  ensureTextSizeChoice(source.textSize);
  quickTextColorValue.textContent = source.textColor.toLowerCase();
  quickBackgroundColorValue.textContent = source.backgroundColor.toLowerCase();
  quickPreviewExactSource = source.image ? {
    image: source.image,
    text: source.text,
    textSize: String(source.textSize),
    textColor: source.textColor,
    backgroundColor: source.backgroundColor,
  } : null;
  quickPreviewRecolorToken += 1;
  quickStateNote.textContent = source.planned?.button?.appearance?.states
    ? `Editing base state · preview toggle state: ${previewToggleState}`
    : item.type === 'existing'
      ? 'Editing base style · active Companion feedback may override it until the button changes state'
      : 'Editing base button style';
  quickButtonEditor.classList.remove('hidden');
  const previewKey = document.querySelector('#deck-button');
  previewKey.dataset.ccbLocation = `${item.page}/${item.row}/${item.column}`;
  // Prepare the simulated layer while the exact Companion image is visible.
  // Color-only changes can reveal it without recalculating typography.
  setQuickPreviewTypography(source.text, source.textSize);
  const rendered = document.querySelector('#button-render');
  previewKey.classList.remove('quick-simulated');
  if (source.image) { rendered.src = source.image; rendered.classList.remove('hidden'); previewKey.classList.add('exact-render'); }
  else paintQuickPreview();
  document.querySelector('#button-location').textContent = `Page ${item.page} · Row ${item.row} · Column ${item.column}`;
  document.querySelector('#behavior').textContent = item.type === 'existing' ? 'Existing Companion button · actions and feedbacks preserved' : 'Builder button · programmed action preserved';
  const manifest = document.querySelector('#action-manifest');
  manifest.replaceChildren(...source.actions.map((action) => { const row = document.createElement('li'); row.textContent = `Step ${action.step} · ${action.summary}${action.actionId ? ` · ${action.actionId}` : ''}`; return row; }));
  validation.textContent = `Selected ${item.page}/${item.row}/${item.column} · quick editing`; validation.style.color = 'var(--cyan)';
  empty.classList.add('hidden'); error.classList.add('hidden'); result.classList.remove('hidden');
  confirmAddButton.classList.add('hidden'); updatePreviewButton.classList.add('hidden');
}

function applySelectedQuickEdit() {
  const source = selectedButtonSource();
  if (!source) return;
  const changes = { text: quickButtonText.value, textColor: quickTextColor.value, backgroundColor: quickBackgroundColor.value, textSize: quickTextSize.dataset.deploymentValue || companionSafeFontPercent(quickButtonText.value, quickTextSize.value) };
  const preserveTypography = changes.text === source.text && String(quickTextSize.value) === String(source.textSize ?? 'auto');
  if (source.planned && selectedGridItem.type === 'planned') {
    source.planned.button.text = changes.text;
    source.planned.button.appearance = { ...source.planned.button.appearance, textColor: changes.textColor, backgroundColor: changes.backgroundColor, textSize: changes.textSize };
    if (source.planned.button.appearance.states?.unmuted) {
      source.planned.button.appearance.states.unmuted = { ...source.planned.button.appearance.states.unmuted, textColor: changes.textColor, backgroundColor: changes.backgroundColor, textSize: changes.textSize };
    }
    currentPlan = source.planned;
    saveActiveDeviceLayer(); setSessionDirty(true); paintQuickPreview({ preserveTypography }); renderSurface();
    deployStatus.textContent = `Updated Builder preview at ${selectedGridItem.page}/${selectedGridItem.row}/${selectedGridItem.column}; programmed actions preserved.`;
    return;
  }
  const location = { page: selectedGridItem.page, row: selectedGridItem.row, column: selectedGridItem.column };
  const plan = {
    schemaVersion: 1, kind: 'edit-button', target: { product: 'Bitfocus Companion', version: '5.0.3', address: addressInput.value.trim() },
    button: { location, text: changes.text, appearance: { textColor: changes.textColor, backgroundColor: changes.backgroundColor, textSize: changes.textSize }, action: { family: 'existing', operation: 'preserve' } },
    actions: [{ step: '—', actionId: 'preserved', summary: 'Preserve every existing action and feedback' }],
    edit: { changes, original: { text: source.text, textColor: source.textColor, backgroundColor: source.backgroundColor, textSize: source.textSize }, descriptions: ['Quick visual edit'] }, sourceText: `Quick edit ${location.page}/${location.row}/${location.column}`,
  };
  currentPlans = [plan]; currentPlan = plan; paintQuickPreview({ preserveTypography }); renderSurface();
  updatePreviewButton.classList.remove('hidden'); updatePreviewButton.disabled = !companionOnline;
  deployStatus.textContent = `Quick edit preview ready for ${location.page}/${location.row}/${location.column}. Press Apply Update to Companion.`; deployStatus.style.color = 'var(--cyan)';
}

function renderSelectedButtonSummary() {
  if (!selectedGridItem) {
    selectedButtonSummary.innerHTML = '<b>SELECTED BUTTON</b><span>Select a programmed button to view its actions.</span>';
    return;
  }
  const item = selectedGridItem;
  if (item.type === 'empty') {
    selectedButtonSummary.innerHTML = `<b>PASTE DESTINATION · ${item.page}/${item.row}/${item.column}</b><span>${buttonClipboard ? `Ready to paste ${buttonClipboard.mode === 'cut' ? 'and move' : 'a copy of'} “${buttonClipboard.label}”.` : 'Copy or cut a button, then select this empty position.'}</span>`;
    return;
  }
  const existing = existingButtons.find((button) => button.row === item.row && button.column === item.column);
  const planned = surfacePlans().find((plan) => plan.button.location.page === item.page && plan.button.location.row === item.row && plan.button.location.column === item.column);
  const actions = item.type === 'planned'
    ? (planned?.actions || []).map((action) => `Step ${action.step} · ${action.summary}`)
    : existing?.actions || item.existing?.actions || [];
  const title = `${item.page}/${item.row}/${item.column}${(planned?.button.text || existing?.text) ? ` · ${(planned?.button.text || existing?.text).replace(/\n/g, ' ')}` : ''}`;
  selectedButtonSummary.replaceChildren();
  const heading = document.createElement('b'); heading.textContent = `SELECTED BUTTON · ${title}`;
  selectedButtonSummary.append(heading);
  if (!actions.length) {
    const fallback = document.createElement('span'); fallback.textContent = item.type === 'existing' ? 'No action details were exposed by Companion for this control.' : 'No programmed actions.';
    selectedButtonSummary.append(fallback);
  } else {
    const list = document.createElement('ol');
    for (const summary of actions) { const row = document.createElement('li'); row.textContent = summary; list.append(row); }
    selectedButtonSummary.append(list);
  }
  renderSelectedTargetModule(planned, existing || item.existing);
}

function renderSelectedTargetModule(planned, existing) {
  const connectionIds = new Set((existing?.programmedActions || []).map((action) => action.connectionId).filter(Boolean));
  let connections = activeConnections.filter((connection) => connectionIds.has(connection.id));
  if (!connections.length && planned?.module?.id) connections = activeConnections.filter((connection) => connection.moduleId === planned.module.id && (!planned.module.connectionLabel || connection.label === planned.module.connectionLabel));
  if (!connections.length && (existing?.programmedActions || []).some((action) => ['mute', 'auxmute', 'cgmute', 'fader', 'snapshot', 'snapshotNext', 'snapshotPrev', 'macros'].includes(action.definitionId))) connections = activeConnections.filter((connection) => connection.moduleId === 'digico-osc');
  const panel = document.createElement('div'); panel.className = 'selected-target-module';
  const title = document.createElement('b'); title.textContent = 'TARGET MODULE & CONNECTION'; panel.append(title);
  if (!connections.length) {
    const note = document.createElement('span'); note.textContent = planned?.module?.id ? `${planned.module.id} · no matching active Companion connection` : 'Companion did not expose a target connection for this button.';
    panel.append(note); selectedButtonSummary.append(panel); return;
  }
  for (const connection of connections) {
    const row = document.createElement('div');
    const details = document.createElement('span'); details.textContent = `${connection.label || connection.moduleId} · ${connection.moduleId} ${connection.moduleVersionId || ''} · loading network settings…`;
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'View / Edit Connection'; edit.addEventListener('click', () => beginEditConnection(connection));
    row.append(details, edit); panel.append(row);
    loadSelectedConnectionNetworkInfo(connection, details);
  }
  selectedButtonSummary.append(panel);
}

async function loadSelectedConnectionNetworkInfo(connection, target) {
  const cached = connectionNetworkCache.get(connection.id);
  if (cached) { target.textContent = cached; return; }
  try {
    const response = await fetch('/api/companion-connections/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), connectionId: connection.id }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    const network = Object.entries(data.config || {}).filter(([key, value]) => /(?:host|address|ip|port)/i.test(key) && value !== '' && value != null).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
    target.textContent = `${connection.label || connection.moduleId} · ${connection.moduleId} ${connection.moduleVersionId || ''}${network.length ? ` · ${network.join(' · ')}` : ' · no host or port assigned'}`;
    connectionNetworkCache.set(connection.id, target.textContent);
  } catch { target.textContent = `${connection.label || connection.moduleId} · ${connection.moduleId} ${connection.moduleVersionId || ''} · network settings unavailable`; }
}

function copyOrCutSelectedButton(mode) {
  if (!selectedGridItem || selectedGridItem.type === 'empty') return;
  const surface = selectedSurface();
  const location = { page: selectedGridItem.page, row: selectedGridItem.row, column: selectedGridItem.column };
  const planned = surfacePlans().find((plan) => plan.button.location.page === location.page && plan.button.location.row === location.row && plan.button.location.column === location.column);
  const existing = selectedGridItem.existing || existingButtons.find((button) => button.row === location.row && button.column === location.column);
  if (selectedGridItem.type === 'existing' && surface?.id) {
    buttonClipboard = { type: 'companion', mode, label: existing?.text || 'Companion button', sourceSurfaceId: surface.id, source: location };
  } else if (planned) {
    buttonClipboard = { type: 'planned', mode, label: planned.button.text.replace(/\n/g, ' '), plan: structuredClone(planned), sourceLayerId: activeDeviceLayerId, sourcePlanKey: devicePlanKey(activeDeviceLayer()?.deviceId || '', location.page), source: location };
  } else return;
  pasteButton.disabled = selectedGridItem.type !== 'empty';
  deployStatus.textContent = `${mode === 'cut' ? 'Cut' : 'Copied'} “${buttonClipboard.label}”. Switch devices or layers, select an empty destination, then press Paste.`;
  deployStatus.style.color = 'var(--cyan)';
  renderSelectedButtonSummary();
}

function removeCutPlannedSource(clipboard) {
  const matches = (plan) => {
    const location = plan.button.location;
    return location.page === clipboard.source.page && location.row === clipboard.source.row && location.column === clipboard.source.column;
  };
  for (const layer of deviceLayers) if (layer.id === clipboard.sourceLayerId) layer.plans = (layer.plans || []).filter((plan) => !matches(plan));
  if (devicePlanCache[clipboard.sourcePlanKey]) devicePlanCache[clipboard.sourcePlanKey] = devicePlanCache[clipboard.sourcePlanKey].filter((plan) => !matches(plan));
  if (activeDeviceLayerId === clipboard.sourceLayerId) currentPlans = currentPlans.filter((plan) => !matches(plan));
  localStorage.setItem('device-layouts-v1', JSON.stringify(deviceLayers));
  localStorage.setItem('device-plan-cache-v2', JSON.stringify(devicePlanCache));
}

async function pasteButtonClipboard() {
  if (!buttonClipboard || selectedGridItem?.type !== 'empty') return;
  const targetSurface = selectedSurface();
  const target = { page: selectedGridItem.page, row: selectedGridItem.row, column: selectedGridItem.column };
  pasteButton.disabled = true;
  try {
    if (buttonClipboard.type === 'companion') {
      if (!companionOnline || !targetSurface?.id || targetSurface.offline) throw new Error('Select an empty position on a connected destination device.');
      const response = await fetch('/api/companion-button-transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), mode: buttonClipboard.mode, sourceSurfaceId: buttonClipboard.sourceSurfaceId, targetSurfaceId: targetSurface.id, source: buttonClipboard.source, target }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refreshExistingButtons(target.page, true);
      for (const page of moveRefreshPages(buttonClipboard.mode === 'cut' ? buttonClipboard.source?.page : null, target.page).filter((page) => page !== target.page)) await refreshWorkspaceButtonCaches(page);
    } else {
      const plan = structuredClone(buttonClipboard.plan);
      plan.button.location = target;
      if (targetSurface?.offline) {
        currentPlans.push(plan);
        saveActiveDeviceLayer();
      } else {
        const response = await fetch('/api/deploy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plans: [plan], address: addressInput.value.trim(), surfaceId: targetSurface.id }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        await refreshExistingButtons(target.page, true);
      }
      if (buttonClipboard.mode === 'cut') removeCutPlannedSource(buttonClipboard);
    }
    const completedMode = buttonClipboard.mode;
    const label = buttonClipboard.label;
    if (completedMode === 'cut') buttonClipboard = null;
    selectedGridItem = null;
    setSessionDirty(true);
    deployStatus.textContent = `${completedMode === 'cut' ? 'Moved' : 'Pasted'} “${label}” to ${target.page}/${target.row}/${target.column} on ${targetSurface?.name || 'the Builder layer'}.`;
    deployStatus.style.color = 'var(--lime)';
    renderSurface();
  } catch (problem) {
    deployStatus.textContent = `Paste failed: ${problem.message}`;
    deployStatus.style.color = 'var(--red)';
  } finally {
    pasteButton.disabled = !(buttonClipboard && selectedGridItem?.type === 'empty');
  }
}

function setPushButton(label = 'Push Layout from Builder', detail = 'Send planned changes to Companion') {
  deployButton.replaceChildren();
  const icon = document.createElement('span'); icon.textContent = '↑';
  const title = document.createElement('b'); title.textContent = label;
  const small = document.createElement('small'); small.textContent = detail;
  deployButton.append(icon, title, small);
}

function updateOfflineTemplateState() {
  // The legacy select remains an internal active-model store. All user-facing
  // online and offline surface enrollment now happens in Workspace surfaces.
  modelSelect.disabled = false;
  updateAppContextStatus();
}

function updateAppContextStatus() {
  const target = targetModuleSelect.selectedOptions[0]?.textContent?.split(' · ')[0] || 'Multi-module';
  const moduleName = targetModuleSelect.value ? target : 'Multi-module';
  const surface = connectedSurfaces.find((item) => item.id === deviceSelect.value && item.connected !== false);
  document.querySelector('#app-context-status').textContent = surface
    ? `${moduleName} · Live device · ${surface.name}`
    : `${moduleName} · Offline editor`;
}

async function refreshAiOnlineStatus() {
  if (!aiEnabled.checked) {
    aiOnlineStatus.textContent = 'Disabled'; aiOnlineStatus.className = 'ai-online-status disabled'; return;
  }
  try {
    const response = await fetch('/api/status'); const data = await response.json();
    const online = Boolean(response.ok && data.ai?.online);
    aiOnlineStatus.textContent = online ? `${data.ai.model} Online` : 'Ollama Offline';
    aiOnlineStatus.className = `ai-online-status ${online ? 'online' : 'offline'}`;
  } catch { aiOnlineStatus.textContent = 'Ollama Offline'; aiOnlineStatus.className = 'ai-online-status offline'; }
}

addressInput.value = localStorage.getItem('companion-address') || '127.0.0.1:8000';
satelliteAddressInput.value = localStorage.getItem('satellite-address') || '';
document.querySelector('#builder-port').textContent = window.location.port || '3100';

function updateNetworkOverview() {
  const address = addressInput.value.trim();
  const portMatch = address.replace(/^https?:\/\//, '').match(/:(\d+)$/);
  document.querySelector('#companion-port').textContent = portMatch?.[1] || '8000';
  const satellites = connectedSurfaces.filter((surface) => surface.satellite);
  satelliteStatus.textContent = satellites.length
    ? `${satellites.length} Satellite surface${satellites.length === 1 ? '' : 's'} connected${satellites.some((surface) => surface.location) ? ` · ${[...new Set(satellites.map((surface) => surface.location).filter(Boolean))].join(', ')}` : ''}`
    : companionOnline ? 'Companion connected · waiting for Satellite' : 'No Satellite surface detected';
  satelliteStatus.classList.toggle('online', Boolean(satellites.length));
  openSatelliteButton.disabled = !satelliteAddressInput.value.trim();
}

function renderOscTestReceiver(data) {
  // Polling must not erase a port while the operator is typing it.
  if (document.activeElement !== oscTestPort && !oscTestPort.dataset.dirty) oscTestPort.value = String(data.port || 9000);
  oscTestToggle.textContent = data.listening ? 'Stop Receiver' : 'Start Receiver';
  oscTestApplyPort.textContent = data.listening && Number(oscTestPort.value) !== Number(data.port) ? 'Apply New Port' : 'Apply Port';
  oscTestStatus.textContent = data.error ? 'Receiver Error' : data.listening ? `Listening · UDP ${data.port}` : 'Stopped';
  oscTestStatus.className = data.error ? 'error' : data.listening ? 'online' : 'offline';
  const events = data.events || [];
  oscTestCount.textContent = `${events.length} packet${events.length === 1 ? '' : 's'} received${events.length === 200 ? ' · showing newest 200' : ''}`;
  if (!events.length) { oscTestLog.innerHTML = '<span>No OSC packets received.</span>'; return; }
  oscTestLog.replaceChildren(...events.map((event) => {
    const row = document.createElement('div'); row.className = `osc-event${event.error ? ' error' : ''}`;
    const time = document.createElement('time'); time.textContent = new Date(event.receivedAt).toLocaleTimeString();
    const address = document.createElement('b'); address.textContent = event.error || event.address;
    const args = document.createElement('code'); args.textContent = event.error ? `${event.bytes} undecoded bytes` : JSON.stringify(event.args || []);
    const remote = document.createElement('small'); remote.textContent = `${event.remoteAddress}:${event.remotePort}${event.bundled ? ' · bundle' : ''}`;
    row.append(time, address, args, remote); return row;
  }));
}

async function refreshOscTestReceiver() {
  try { const response = await fetch('/api/osc-test-receiver'); const data = await response.json(); if (response.ok) renderOscTestReceiver(data); }
  catch { oscTestStatus.textContent = 'Unavailable'; oscTestStatus.className = 'error'; }
}

async function controlOscTestReceiver(action) {
  oscTestToggle.disabled = true;
  oscTestApplyPort.disabled = true;
  try {
    const response = await fetch('/api/osc-test-receiver', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, port: Number(oscTestPort.value) }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error); oscTestPort.dataset.dirty = ''; renderOscTestReceiver(data);
  } catch (problem) { oscTestStatus.textContent = problem.message; oscTestStatus.className = 'error'; }
  finally { oscTestToggle.disabled = false; oscTestApplyPort.disabled = false; }
}

async function selfTestOscReceiver() {
  oscTestSelf.disabled = true;
  try {
    if (!oscTestStatus.classList.contains('online') || oscTestPort.dataset.dirty) await controlOscTestReceiver('start');
    const response = await fetch('/api/osc-test-receiver', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'self-test', port: Number(oscTestPort.value) }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    renderOscTestReceiver(data);
    oscTestStatus.textContent = `Self-Test Passed · UDP ${data.port}`; oscTestStatus.className = 'online';
  } catch (problem) { oscTestStatus.textContent = `Self-Test Failed · ${problem.message}`; oscTestStatus.className = 'error'; }
  finally { oscTestSelf.disabled = false; }
}

function moduleIsEnabled(moduleId) { return !disabledModuleIds.has(moduleId); }

function moduleUseButton(moduleId, row) {
  const button = document.createElement('button');
  const enabled = moduleIsEnabled(moduleId);
  button.type = 'button';
  button.className = 'module-use-toggle';
  button.textContent = enabled ? 'CCB ON' : 'CCB OFF';
  button.title = enabled ? 'Disable this module for CCB parsing and Auto Detect' : 'Enable this module for CCB parsing and Auto Detect';
  row.classList.toggle('ccb-disabled', !enabled);
  button.addEventListener('click', async () => {
    if (enabled) disabledModuleIds.add(moduleId); else disabledModuleIds.delete(moduleId);
    localStorage.setItem('ccb-disabled-modules', JSON.stringify([...disabledModuleIds]));
    if (targetModuleSelect.value === moduleId && disabledModuleIds.has(moduleId)) {
      targetModuleSelect.value = '';
      localStorage.removeItem('target-module-id');
    }
    await Promise.all([refreshInstalledModules(), refreshButtonGraphics(addressInput.value.trim())]);
    deployStatus.textContent = `${moduleId} is now ${moduleIsEnabled(moduleId) ? 'enabled' : 'disabled'} for CCB commands. The Companion connection itself was not changed.`;
    deployStatus.style.color = moduleIsEnabled(moduleId) ? 'var(--lime)' : 'var(--cyan)';
  });
  return button;
}

async function refreshButtonGraphics(address) {
  const selected = buttonGraphicSelect.value || localStorage.getItem('button-graphic') || '';
  try {
    const [response, installedResponse] = await Promise.all([
      fetch(`/api/companion-connections?address=${encodeURIComponent(address)}`),
      fetch('/api/installed-modules'),
    ]);
    const [data, installedData] = await Promise.all([response.json(), installedResponse.json()]);
    if (!response.ok) throw new Error(data.error);
    const connections = (data.connections || []).filter((item) => item.enabled !== false);
    activeConnections = connections;
    knownModuleIds = [...new Set([...(installedData.modules || []).map((module) => module.moduleId), ...connections.map((connection) => connection.moduleId)])];
    const installedById = new Map((installedData.modules || []).map((module) => [module.moduleId, module]));
    activeButtonGraphics = Object.fromEntries(connections.filter((connection) => moduleIsEnabled(connection.moduleId)).flatMap((connection) => (connection.adapter?.graphics || []).map((graphic) => [graphic.id, { ...graphic, moduleId: connection.moduleId }])));
    buttonGraphicSelect.replaceChildren(new Option('No image · text only', ''));
    for (const [id, graphic] of Object.entries(activeButtonGraphics)) buttonGraphicSelect.append(new Option(`${graphic.symbol}  ${graphic.label}`, id));
    buttonGraphicSelect.value = [...buttonGraphicSelect.options].some((option) => option.value === selected) ? selected : '';
    buttonGraphicSelect.disabled = buttonGraphicSelect.options.length === 1;
    buttonGraphicNote.textContent = Object.keys(activeButtonGraphics).length ? 'Adapter graphics · applied to next preview' : 'No supported image library for active connections';
    const registry = document.querySelector('#connection-registry-list');
    const rows = connections.map((connection) => {
      const row = document.createElement('article');
      const adapter = connection.adapter || {};
      const onboarding = installedById.get(connection.moduleId)?.onboarding;
      const onboardingComplete = Boolean(onboarding?.configuredAt);
      row.className = `registry-connection active ${adapter.status || 'discovered'}`;
      const badge = adapter.status === 'supported' ? 'SUPPORTED' : adapter.status === 'version-mismatch' ? 'VERSION MISMATCH' : 'DISCOVERED';
      row.innerHTML = `<div><strong>${connection.label || connection.moduleId}</strong><span>${connection.moduleId} · ${connection.moduleVersionId || 'unknown version'}</span></div><b>ACTIVE · ${badge}</b><small>${adapter.capabilities?.length ? adapter.capabilities.join(' · ') : onboarding?.pendingConnection ? 'Offline support configuration complete · edit connection settings to finish live validation' : onboarding?.pendingReadback ? 'Action catalog compiled · connect an online surface to finish read-back' : onboardingComplete ? 'Support analysis complete' : 'Adapter mapping pending'}</small>`;
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'EDIT';
      edit.addEventListener('click', () => beginEditConnection(connection, Boolean(onboarding?.pendingConnection)));
      row.insertBefore(edit, row.querySelector('small'));
      row.insertBefore(moduleUseButton(connection.moduleId, row), row.querySelector('small'));
      if (adapter.status !== 'supported' && !onboarding?.pendingConnection && !onboarding?.pendingReadback) {
        const configure = document.createElement('button'); configure.type = 'button';
        configure.textContent = 'COMPLETE CONFIGURATION';
        configure.addEventListener('click', () => configureModuleSupport(connection.moduleId, configure, connection.id));
        row.insertBefore(configure, row.querySelector('small'));
      }
      return row;
    });
    const activeIds = new Set(connections.map((connection) => connection.moduleId));
    for (const module of installedData.modules || []) {
      if (activeIds.has(module.moduleId)) continue;
      const row = document.createElement('article');
      row.className = 'registry-connection inactive';
      const details = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = module.name;
      const version = document.createElement('span'); version.textContent = `${module.moduleId} · ${module.version}`;
      details.append(name, version);
      const badge = document.createElement('b'); badge.textContent = 'INACTIVE';
      const add = document.createElement('button'); add.type = 'button'; add.textContent = 'ADD'; add.disabled = !companionOnline;
      add.addEventListener('click', () => beginConnectionWizard(module));
      let configure = null;
      if (module.adapter?.status !== 'supported' && !module.onboarding?.pendingConnection && !module.onboarding?.pendingReadback) {
        configure = document.createElement('button'); configure.type = 'button';
        configure.textContent = 'COMPLETE CONFIGURATION';
        configure.addEventListener('click', () => configureModuleSupport(module.moduleId, configure));
      }
      const note = document.createElement('small');
      const promptCount = module.onboarding?.prompts?.length || 0;
      note.textContent = module.onboarding?.pendingConnection
        ? `Offline support configuration complete · ${promptCount} prompts audited · add and enable a connection to finish live validation`
        : module.onboarding?.pendingReadback
          ? `Live action catalog compiled · connect an online surface to finish temporary-control read-back`
          : module.onboarding?.configuredAt
        ? `Support analysis complete · ${promptCount} prompts audited`
        : `Installed in Companion · ${promptCount} generated prompts audited · configuration required`;
      row.append(details, badge, add);
      row.append(moduleUseButton(module.moduleId, row));
      if (configure) row.append(configure);
      row.append(note); rows.push(row);
    }
    registry.replaceChildren(...rows);
    if (!rows.length) registry.replaceChildren(Object.assign(document.createElement('span'), { textContent: 'No installed Companion connection modules were found.' }));
    document.querySelector('#connection-registry-summary').textContent = `${connections.length} active connection${connections.length === 1 ? '' : 's'} · ${Math.max(0, rows.length - connections.length)} installed inactive module${rows.length - connections.length === 1 ? '' : 's'}.`;
  } catch {
    buttonGraphicSelect.replaceChildren(new Option('Connection images unavailable', ''));
    buttonGraphicSelect.disabled = true;
    buttonGraphicNote.textContent = 'Reconnect Companion to refresh images';
    document.querySelector('#connection-registry-list').replaceChildren(Object.assign(document.createElement('span'), { textContent: 'Connection inventory unavailable.' }));
  }
}

function connectionFieldControl(field, value) {
  let control;
  if (field.type === 'dropdown' || field.type === 'multidropdown') {
    control = document.createElement('select');
    control.multiple = field.type === 'multidropdown';
    for (const choice of field.choices || []) control.append(new Option(choice.label, String(choice.id)));
    if (control.multiple) for (const option of control.options) option.selected = Array.isArray(value) && value.map(String).includes(option.value);
    else control.value = value == null ? '' : String(value);
  } else if (field.type === 'checkbox') {
    control = document.createElement('input'); control.type = 'checkbox'; control.checked = Boolean(value);
  } else {
    control = document.createElement('input');
    control.type = field.type?.startsWith('secret') ? 'password' : field.type === 'number' ? 'number' : 'text';
    control.value = value == null ? '' : String(value);
    if (field.min != null) control.min = field.min;
    if (field.max != null) control.max = field.max;
    if (field.placeholder != null) control.placeholder = field.placeholder;
    if (field.required) control.required = true;
  }
  control.dataset.fieldId = field.id;
  control.dataset.secret = String(field.type?.startsWith('secret'));
  control.dataset.valueType = field.type || 'textinput';
  return control;
}

async function beginConnectionWizard(module) {
  const suggested = module.moduleId.replace(/[^a-z0-9_-]/gi, '_');
  showConnectionWizard({ pendingModule: true, module, label: suggested, fields: [], config: {}, secrets: {} }, `Add ${module.name}`, `Stage 1 of 2 · Choose the connection label, then CCB will load this module’s required setup fields from Companion.`);
}

function showConnectionWizard(draft, title, message) {
    connectionDraft = draft; connectionWizardFields.replaceChildren(); connectionWizardReview.classList.add('hidden');
    document.querySelector('#connection-wizard-title').textContent = title;
    document.querySelector('#connection-wizard-message').textContent = message;
    const labelRow = document.createElement('div'); labelRow.className = 'connection-wizard-field';
    const labelTitle = document.createElement('label'); labelTitle.textContent = 'Connection label';
    const labelInput = document.createElement('input'); labelInput.id = 'connection-wizard-label'; labelInput.value = draft.label || ''; labelInput.required = true; labelInput.pattern = '[A-Za-z0-9_-]+';
    const labelHelp = document.createElement('span'); labelHelp.textContent = 'Letters, numbers, underscores, and dashes';
    labelRow.append(labelTitle, labelInput, labelHelp); connectionWizardFields.append(labelRow);
    for (const field of draft.fields || []) {
      if (field.type === 'static-text') continue;
      const row = document.createElement('div'); row.className = `connection-wizard-field ${field.type === 'checkbox' ? 'checkbox' : ''}`;
      const fieldLabel = document.createElement('label'); fieldLabel.textContent = field.label || field.id;
      const source = field.type?.startsWith('secret') ? draft.secrets : draft.config;
      const control = connectionFieldControl(field, source?.[field.id] ?? field.default);
      row.append(fieldLabel, control);
      if (field.description || field.tooltip) { const note = document.createElement('span'); note.textContent = field.description || field.tooltip; row.append(note); }
      connectionWizardFields.append(row);
    }
    if (!draft.pendingModule && !(draft.fields || []).some((field) => field.type !== 'static-text')) {
      const empty = document.createElement('div'); empty.className = 'sync-compatibility mismatch';
      empty.textContent = 'Companion reported that this module has no additional setup fields. If that is unexpected, open its native Companion editor after creation.';
      connectionWizardFields.append(empty);
    }
    connectionWizardConfirm.textContent = draft.pendingModule ? 'Load setup fields' : draft.existing ? 'Review changes' : 'Review connection';
    if (!connectionWizardDialog.open) connectionWizardDialog.showModal();
}

async function beginEditConnection(connection, finishSupportAfterSave = false) {
  deployStatus.textContent = `Loading ${connection.label} configuration…`;
  try {
    const response = await fetch('/api/companion-connections/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), connectionId: connection.id }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    showConnectionWizard({ ...data, moduleId: connection.moduleId, finishSupportAfterSave }, `Edit ${connection.label}`, `${connection.moduleId} ${connection.moduleVersionId}. Changes are saved directly to this active Companion connection.${finishSupportAfterSave ? ' CCB will automatically finish live support validation afterward.' : ''}`);
  } catch (error) { deployStatus.textContent = error.message; deployStatus.style.color = 'var(--red)'; }
}

async function cancelConnectionWizard() {
  const draft = connectionDraft; connectionDraft = null; connectionWizardDialog.close();
  if (draft?.connectionId && !draft.existing) await fetch('/api/companion-connections/configure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), connectionId: draft.connectionId, cancel: true }) }).catch(() => {});
}

document.querySelector('#connection-wizard-cancel').addEventListener('click', cancelConnectionWizard);
connectionWizardDialog.addEventListener('cancel', (event) => { event.preventDefault(); cancelConnectionWizard(); });
connectionWizardForm.addEventListener('submit', async (event) => {
  event.preventDefault(); if (!connectionDraft) return;
  const saveLabel = document.querySelector('#connection-wizard-label').value.trim();
  if (connectionDraft.pendingModule) {
    const module = connectionDraft.module;
    connectionWizardConfirm.disabled = true;
    connectionWizardConfirm.textContent = 'Loading setup fields…';
    try {
      const response = await fetch('/api/companion-connections/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), moduleId: module.moduleId, version: module.version, label: saveLabel }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      showConnectionWizard({ ...data, existing: false, finishSupportAfterSave: Boolean(module.onboarding?.pendingConnection) }, `Configure ${module.name}`, `Stage 2 of 2 · Enter the host, ports, devices, and other settings supplied by ${module.name}.${module.onboarding?.pendingConnection ? ' CCB will automatically finish live support validation afterward.' : ''}`);
    } catch (error) {
      connectionWizardReview.textContent = error.message; connectionWizardReview.classList.remove('hidden');
      connectionWizardConfirm.textContent = 'Retry loading fields';
    } finally { connectionWizardConfirm.disabled = false; }
    return;
  }
  const config = { ...connectionDraft.config }, secrets = { ...connectionDraft.secrets };
  for (const control of connectionWizardFields.querySelectorAll('[data-field-id]')) {
    let value = control.type === 'checkbox' ? control.checked : control.multiple ? [...control.selectedOptions].map((option) => option.value) : control.value;
    if (control.dataset.valueType === 'number') value = value === '' ? 0 : Number(value);
    (control.dataset.secret === 'true' ? secrets : config)[control.dataset.fieldId] = value;
  }
  const finalButtonText = connectionDraft.existing ? 'Save changes' : 'Create connection';
  if (connectionWizardConfirm.textContent !== finalButtonText) {
    connectionWizardReview.textContent = `${connectionDraft.existing ? 'Update' : 'Create and enable'} “${saveLabel}” in Companion with ${Object.keys(config).length + Object.keys(secrets).length} configuration value(s)? Existing button programming will not be changed.`;
    connectionWizardReview.classList.remove('hidden'); connectionWizardConfirm.textContent = finalButtonText; return;
  }
  connectionWizardConfirm.disabled = true;
  try {
    const wasExisting = connectionDraft.existing;
    const finishModuleId = connectionDraft.finishSupportAfterSave ? connectionDraft.moduleId : '';
    const finishConnectionId = connectionDraft.connectionId;
    const response = await fetch('/api/companion-connections/configure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), connectionId: connectionDraft.connectionId, label: saveLabel, config, secrets }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    connectionNetworkCache.delete(connectionDraft.connectionId);
    connectionDraft = null; connectionWizardDialog.close(); await refreshButtonGraphics(addressInput.value.trim());
    deployStatus.textContent = wasExisting ? 'Connection settings updated in Companion.' : 'Connection created and confirmed active by Companion.'; deployStatus.style.color = 'var(--lime)';
    if (finishModuleId) {
      const virtualButton = { textContent: 'COMPLETE CONFIGURATION', disabled: false };
      await configureModuleSupport(finishModuleId, virtualButton, finishConnectionId, true);
    }
  } catch (error) { connectionWizardReview.textContent = error.message; connectionWizardReview.classList.remove('hidden'); }
  finally { connectionWizardConfirm.disabled = false; }
});

function updateTargetModuleNote() {
  const option = targetModuleSelect.selectedOptions[0];
  clearTargetModuleButton.disabled = !targetModuleSelect.value;
  targetModuleNote.textContent = targetModuleSelect.value
    ? `${option?.dataset.status || 'Installed'} · commands locked to ${option?.textContent || targetModuleSelect.value}`
    : 'Automatically choose from the prompt';
  updateAppContextStatus();
}

async function refreshInstalledModules() {
  const selected = targetModuleSelect.value || localStorage.getItem('target-module-id') || '';
  try {
    const response = await fetch('/api/installed-modules');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    knownModuleIds = [...new Set((data.modules || []).map((module) => module.moduleId))];
    targetModuleSelect.replaceChildren(new Option('Auto Detect', ''));
    for (const module of (data.modules || []).filter((item) => moduleIsEnabled(item.moduleId))) {
      const option = new Option(`${module.name} · ${module.version}`, module.moduleId);
      option.dataset.status = module.adapter?.status === 'supported'
        ? `${module.adapter.verification || 'supported'} adapter · ${module.onboarding?.counts?.pass || 0} prompt checks passed`
        : `Adapter mapping pending · ${module.onboarding?.prompts?.length || 0} prompts auto-audited`;
      targetModuleSelect.append(option);
    }
    targetModuleSelect.value = [...targetModuleSelect.options].some((option) => option.value === selected) ? selected : '';
  } catch {
    targetModuleSelect.replaceChildren(new Option('Auto Detect · module inventory unavailable', ''));
  }
  updateTargetModuleNote();
}

async function refreshConnectionInventory() {
  if (!companionOnline) {
    deployStatus.textContent = 'Connect to Companion before refreshing the connection inventory.';
    deployStatus.style.color = 'var(--red)';
    return;
  }
  refreshConnectionInventoryButton.disabled = true;
  refreshConnectionInventoryButton.textContent = '↻ Refreshing…';
  deployStatus.textContent = 'Rescanning Companion connections, installed modules, and prompt audits…';
  deployStatus.style.color = '';
  try {
    await Promise.all([refreshInstalledModules(), refreshButtonGraphics(addressInput.value.trim())]);
    const activeCount = document.querySelectorAll('.registry-connection.active').length;
    const inactiveCount = document.querySelectorAll('.registry-connection.inactive').length;
    deployStatus.textContent = `Inventory refreshed · ${activeCount} active connection${activeCount === 1 ? '' : 's'} · ${inactiveCount} installed inactive module${inactiveCount === 1 ? '' : 's'}.`;
    deployStatus.style.color = 'var(--lime)';
  } catch (error) {
    deployStatus.textContent = `Inventory refresh failed: ${error.message}`;
    deployStatus.style.color = 'var(--red)';
  } finally {
    refreshConnectionInventoryButton.disabled = false;
    refreshConnectionInventoryButton.textContent = '↻ Refresh Inventory';
  }
}

function setConnectionRegistryCollapsed(collapsed) {
  connectionRegistrySection.classList.toggle('collapsed', collapsed);
  toggleConnectionRegistryButton.setAttribute('aria-expanded', String(!collapsed));
  toggleConnectionRegistryButton.textContent = collapsed ? '+ Expand' : '− Collapse';
  localStorage.setItem('connection-registry-collapsed', String(collapsed));
}

async function configureModuleSupport(moduleId, button, connectionId = '', skipConfirm = false) {
  const useAi = aiEnabled.checked;
  const selected = selectedSurface();
  const surface = selected?.id && !selected.offline && selected.connected !== false
    ? selected
    : connectedSurfaces.find((item) => item.connected !== false) || null;
  const canReadback = Boolean(connectionId && surface?.id && !surface.offline && surface.connected !== false);
  const detail = useAi
    ? 'CCB will use the installed module documentation and local Ollama to generate and audit real-world prompts. This may take up to two minutes.'
    : 'CCB will generate and audit prompts from the installed module documentation without Ollama.';
  if (!skipConfirm && !window.confirm(`Configure CCB support for ${moduleId}?\n\n${detail}\n\n${canReadback ? 'CCB will briefly create one unpressed test control in an empty key, read it back, and remove it. No device action will be executed.' : 'No Companion buttons or connection settings will be changed. Select an online surface to include temporary-control read-back validation.'}`)) return;
  const original = button.textContent; button.disabled = true; button.textContent = 'RUNNING…';
  document.querySelector('#support-progress-title').textContent = `Configuring ${moduleId}`;
  supportProgressFill.style.width = '0%'; supportProgressStage.textContent = 'Submitting support job…'; supportProgressPercent.textContent = '0%';
  supportProgressFill.parentElement.setAttribute('aria-valuenow', '0'); supportProgressSummary.classList.add('hidden'); supportProgressSummary.classList.remove('mismatch'); supportProgressClose.disabled = true;
  supportProgressDialog.showModal();
  deployStatus.textContent = `Building and testing the ${moduleId} support candidate${useAi ? ' with Ollama' : ''}…`;
  deployStatus.style.color = '';
  try {
    const response = await fetch('/api/module-onboarding/configure', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ moduleId, useAi, connectionId, address: addressInput.value.trim(), readback: canReadback, surfaceId: surface?.id || '', pageNumber: viewedPage() }),
    });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    let job;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const statusResponse = await fetch(`/api/module-onboarding/status?id=${encodeURIComponent(data.jobId)}`);
      job = await statusResponse.json(); if (!statusResponse.ok) throw new Error(job.error);
      const percent = Math.max(0, Math.min(100, Number(job.percent || 0)));
      supportProgressFill.style.width = `${percent}%`; supportProgressPercent.textContent = `${percent}%`;
      supportProgressFill.parentElement.setAttribute('aria-valuenow', String(percent)); supportProgressStage.textContent = job.stage || 'Working…';
      if (job.status === 'complete') break;
      if (job.status === 'error') throw new Error(job.error || 'Support configuration failed.');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (job?.status !== 'complete') throw new Error('Support configuration timed out.');
    const report = job.result; const gates = report.gates || {}; const counts = report.counts || {};
    const nextGate = report.pendingConnection ? (connectionId ? 'edit connection settings, then live schema validation will resume automatically' : 'add and enable a Companion connection') : report.pendingReadback ? 'connect an online surface for automatic read-back' : !gates.actionDiscovery ? 'action discovery' : !gates.corpusGenerated ? 'prompt corpus' : !gates.parserMapped ? 'parser mapping' : !gates.schemaTested ? 'schema validation' : !gates.readbackVerified ? 'temporary-control read-back' : 'complete';
    const compiledCount = report.compiledAdapter?.actions?.length || 0;
    deployStatus.textContent = `${moduleId} support audit complete · ${compiledCount ? `${compiledCount} live actions compiled` : `${counts.pass || 0} direct parser tests passed`} · ${report.prompts?.length || 0} prompts audited · next: ${nextGate}.`;
    deployStatus.style.color = gates.supported ? 'var(--lime)' : 'var(--cyan)';
    const schemaCount = Object.keys(report.liveSchema?.actions || {}).length;
    supportProgressSummary.textContent = `Complete · ${schemaCount ? `${schemaCount} live actions captured and compiled · ` : ''}${report.prompts?.length || 0} prompts audited${compiledCount ? ' against the dynamic adapter catalog' : ` · ${counts.pass || 0} direct parser tests passed`} · next gate: ${nextGate}.`;
    supportProgressSummary.classList.remove('hidden'); supportProgressClose.disabled = false;
    supportProgressStage.textContent = gates.supported ? 'Configuration complete · refreshing inventory' : 'Configuration stages complete';
    await refreshConnectionInventory();
    if (gates.supported) {
      deployStatus.textContent = `${moduleId} is active and supported · inventory refreshed.`;
      deployStatus.style.color = 'var(--lime)';
      supportProgressSummary.textContent = `Complete · ${schemaCount} live actions captured and compiled · ${report.prompts?.length || 0} prompts audited · temporary-control read-back verified · module is active and supported.`;
    }
  } catch (error) {
    deployStatus.textContent = `Support configuration failed: ${error.message}`; deployStatus.style.color = 'var(--red)';
    supportProgressStage.textContent = 'Configuration failed'; supportProgressSummary.textContent = error.message;
    supportProgressSummary.classList.remove('hidden'); supportProgressSummary.classList.add('mismatch'); supportProgressClose.disabled = false;
  } finally { button.disabled = false; button.textContent = original; }
}
const savedSurface = localStorage.getItem('surface-model') || 'offline:mk2';
modelSelect.value = savedSurface.startsWith('offline:') ? savedSurface : `offline:${savedSurface}`;
if (savedWorkspaceSurfaceIds === null && !workspaceSurfaceIds.size) workspaceSurfaceIds.add(modelSelect.value);
deviceLayers[0].model = modelSelect.value;
aiEnabled.checked = localStorage.getItem('ai-enabled') !== 'false';
// Layout content is deliberately not restored on launch. CCB starts with a
// blank Builder and only imports controls through explicit device sync or Load.
command.value = '';
devicePlanCache = {};
deviceLayers = [{ id: 'layout-1', name: 'Deck layout 1', page: 1, model: modelSelect.value, deviceId: '', plans: [] }];
activeDeviceLayerId = 'layout-1';

function devicePlanKey(deviceId, page) { return `${deviceId || `offline:${modelSelect.value}`}:${page}`; }
function cachedDevicePlans(deviceId, page) { return structuredClone(devicePlanCache[devicePlanKey(deviceId, page)] || []); }
function allOfflinePlans() {
  const prefix = `offline:${modelSelect.value}:`;
  const plans = Object.entries(devicePlanCache).filter(([key]) => key.startsWith(prefix)).flatMap(([, cached]) => structuredClone(cached || []));
  const unique = new Map();
  for (const plan of plans) if (plan?.button && !['edit-button', 'move-button', 'replace-button'].includes(plan.kind)) unique.set(`${plan.button.location.page}/${plan.button.location.row}/${plan.button.location.column}`, plan);
  return [...unique.values()];
}

function compatibleOfflineTransfer(surface, plans = allOfflinePlans()) {
  const accepted = plans.filter((plan) => fitsSurfaceGrid(surface, plan.button.location, { local: true }));
  const skipped = plans.filter((plan) => !accepted.includes(plan));
  const source = MODELS[modelSelect.value.replace(/^offline:/, '')] || { name: 'Offline template', columns: 0, rows: 0 };
  const sameGrid = source.columns === surface.columns && source.rows === surface.rows;
  return { accepted, skipped, source, sameGrid, message: sameGrid
    ? `Matching ${surface.columns}×${surface.rows} grids · all ${accepted.length} button${accepted.length === 1 ? '' : 's'} can transfer.`
    : `${source.name} is ${source.columns}×${source.rows}; ${surface.name} is ${surface.columns}×${surface.rows}. ${accepted.length} button${accepted.length === 1 ? '' : 's'} will retain their PAGE/ROW/COLUMN positions; ${skipped.length} out-of-range button${skipped.length === 1 ? '' : 's'} will be skipped.` };
}

function chooseDeviceSync(surface, transfer) {
  document.querySelector('#device-sync-title').textContent = `Connect to ${surface.name}`;
  document.querySelector('#device-sync-message').textContent = 'Choose which layout operation to perform. Sync from Device leaves Companion unchanged. Sync from CCB replaces the device. Merge CCB preserves every existing Companion button and fills only empty positions.';
  const report = document.querySelector('#device-sync-compatibility');
  report.textContent = `${transfer.desiredPageCount || deviceLayers.length} offline layer${(transfer.desiredPageCount || deviceLayers.length) === 1 ? '' : 's'} and ${transfer.accepted.length} button${transfer.accepted.length === 1 ? '' : 's'} are ready to sync.`;
  report.classList.remove('mismatch');
  const overwrite = deviceSyncDialog.querySelector('.overwrite-confirm');
  const merge = deviceSyncDialog.querySelector('.merge-confirm');
  overwrite.disabled = false;
  overwrite.classList.remove('hidden');
  merge.disabled = !transfer.accepted.length;
  merge.classList.toggle('hidden', !transfer.accepted.length);
  deviceSyncDialog.showModal();
  return new Promise((resolve) => deviceSyncDialog.addEventListener('close', () => resolve(deviceSyncDialog.returnValue || 'cancel'), { once: true }));
}

function presetDocument() {
  if (!deviceSelect.value) saveActiveDeviceLayer();
  const pages = deviceLayers.map((layer) => ({ page: layer.page, name: layer.name || `Layer ${layer.page}`, plans: structuredClone(layer.plans || []) }));
  const workspaceSurfaces = [...workspaceSurfaceIds].filter((id) => id.startsWith('offline:')).map((model) => {
    const prefix = `offline:${model}:`;
    const storedPages = Object.entries(devicePlanCache).filter(([key]) => key.startsWith(prefix)).map(([key, plans]) => ({ page: Number(key.slice(prefix.length)), name: `Layer ${Number(key.slice(prefix.length))}`, plans: structuredClone(plans || []) })).filter((page) => Number.isInteger(page.page)).sort((a, b) => a.page - b.page);
    return { model, pages: model === modelSelect.value && !deviceSelect.value ? pages : (storedPages.length ? storedPages : [{ page: 1, name: 'Layer 1', plans: [] }]) };
  });
  return { format: 'companion-command-builder-layout', schemaVersion: 1, appVersion: '0.20.56', name: presetFileHandle?.name?.replace(/\.(?:json|ccb-layout)$/i, '') || 'Untitled layout', model: modelSelect.value, savedAt: new Date().toISOString(), pages, workspaceSurfaces };
}

function validatePresetDocument(value) {
  if (value?.format !== 'companion-command-builder-layout' || value.schemaVersion !== 1) throw new Error('This is not a supported Companion Command Builder preset.');
  const model = String(value.model || '');
  if (!model.startsWith('offline:') || !MODELS[model.replace(/^offline:/, '')]) throw new Error('The preset contains an unsupported Stream Deck model.');
  if (!Array.isArray(value.pages) || !value.pages.length) throw new Error('The preset contains no layout pages.');
  for (const page of value.pages) {
    if (!Number.isInteger(page.page) || page.page < 1 || !Array.isArray(page.plans)) throw new Error('The preset contains an invalid page.');
    for (const plan of page.plans) if (!plan?.button?.location || plan.button.location.page !== page.page || !plan.button.action || !plan.button.appearance) throw new Error(`Page ${page.page} contains an invalid button plan.`);
  }
  for (const surface of value.workspaceSurfaces || []) {
    if (!String(surface.model || '').startsWith('offline:') || !MODELS[String(surface.model).replace(/^offline:/, '')] || !Array.isArray(surface.pages)) throw new Error('The preset contains an invalid workspace surface.');
  }
  return value;
}

async function writePreset(saveAs = false) {
  try {
    const documentValue = presetDocument();
    const suggestedName = `${documentValue.name || 'Companion-Layout'}.ccb-layout`;
    if (!saveAs && presetBrowserFileHandle) {
      const writable = await presetBrowserFileHandle.createWritable();
      await writable.write(`${JSON.stringify(documentValue, null, 2)}\n`);
      await writable.close();
      presetFileHandle = { path: '', name: presetBrowserFileHandle.name };
      localStorage.removeItem('ccb-preset-path'); localStorage.setItem('ccb-preset-name', presetBrowserFileHandle.name);
      deployStatus.textContent = `Saved preset: ${presetBrowserFileHandle.name}`;
      deployStatus.style.color = 'var(--lime)'; setSessionDirty(false);
      return;
    }
    if ((saveAs || !presetFileHandle?.path) && typeof window.showSaveFilePicker === 'function') {
      presetBrowserFileHandle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'CCB Layout', accept: { 'application/json': ['.ccb-layout', '.json'] } }],
      });
      const writable = await presetBrowserFileHandle.createWritable();
      await writable.write(`${JSON.stringify(documentValue, null, 2)}\n`);
      await writable.close();
      presetFileHandle = { path: '', name: presetBrowserFileHandle.name };
      localStorage.removeItem('ccb-preset-path'); localStorage.setItem('ccb-preset-name', presetBrowserFileHandle.name);
      deployStatus.textContent = `Saved preset: ${presetBrowserFileHandle.name}`;
      deployStatus.style.color = 'var(--lime)'; setSessionDirty(false);
      return;
    }
    const response = await fetch('/api/presets/save', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ document: documentValue, path: saveAs ? '' : presetFileHandle?.path || '', suggestedName }),
    });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || 'The preset could not be saved.');
    presetFileHandle = { path: saved.path, name: saved.name };
    localStorage.setItem('ccb-preset-path', saved.path); localStorage.setItem('ccb-preset-name', saved.name);
    deployStatus.textContent = `Saved preset: ${saved.name}`;
    deployStatus.style.color = 'var(--lime)';
    setSessionDirty(false);
  } catch (problem) {
    if (problem.name === 'AbortError' || /user canceled/i.test(problem.message)) return;
    deployStatus.textContent = problem.message; deployStatus.style.color = 'var(--red)';
  }
}

async function installPreset(value, fileHandle = null) {
  const preset = validatePresetDocument(value);
  layoutSourceActivated = true;
  const onlineSurface = deviceSelect.value ? selectedSurface() : null;
  const overwriteConnected = Boolean(onlineSurface?.id && !onlineSurface.offline);
  if (overwriteConnected && !window.confirm(`CONFIRM OVERWRITE DEVICE LAYOUT?\n\nLoading this template while connected will permanently clear ${onlineSurface.name} across its Companion layers and replace it with the compatible buttons from this file. Existing device buttons will be removed.\n\nCancel to leave both Companion and the current Builder layout unchanged.`)) return;
  if (!overwriteConnected && (currentPlans.length || existingButtons.length) && !window.confirm('Load this preset into offline editing? Current unpushed Builder changes will be replaced. Companion will not be modified.')) return;
  presetFileHandle = fileHandle;
  if (fileHandle?.path) { localStorage.setItem('ccb-preset-path', fileHandle.path); localStorage.setItem('ccb-preset-name', fileHandle.name || ''); }
  deviceSelect.value = '';
  useOfflineTemplate = true;
  offlineWorkspaceExplicitlyActivated = true;
  localStorage.setItem('use-offline-template', 'true');
  modelSelect.value = preset.model;
  localStorage.setItem('surface-model', preset.model);
  updateOfflineTemplateState();
  // Loading a file is an authoritative layout change. Never let an abandoned
  // command preview keep supplying the grid through surfacePlans().
  pendingButtonPreview = false;
  previewBasePlans = [];
  currentPlan = null;
  currentPlans = [];
  selectedGridItem = null;
  finishDragInteraction();
  for (const key of Object.keys(devicePlanCache)) if (key.startsWith(`offline:${preset.model}:`)) delete devicePlanCache[key];
  deviceLayers = preset.pages.map((page) => ({ id: `layout-${page.page}`, name: page.name || `Layer ${page.page}`, page: page.page, model: preset.model, deviceId: '', plans: structuredClone(page.plans) }));
  for (const layer of deviceLayers) cacheDevicePlans('', layer.page, layer.plans);
  workspaceSurfaceIds = new Set([preset.model]);
  for (const workspaceSurface of preset.workspaceSurfaces || []) {
    workspaceSurfaceIds.add(workspaceSurface.model);
    for (const page of workspaceSurface.pages) devicePlanCache[offlineWorkspacePlanKey(workspaceSurface.model, page.page)] = structuredClone(page.plans || []);
  }
  persistWorkspaceSelection();
  activeDeviceLayerId = deviceLayers[0].id;
  existingButtons = [];
  existingButtonsPage = deviceLayers[0].page;
  renderDeviceLayerOptions(activeDeviceLayerId);
  await loadDeviceLayer(deviceLayers[0]);
  localStorage.setItem('device-layouts-v1', JSON.stringify(deviceLayers));
  deployStatus.textContent = `Loaded preset${preset.name ? ` “${preset.name}”` : ''} · ${preset.pages.length} page${preset.pages.length === 1 ? '' : 's'} · ${preset.pages.reduce((count, page) => count + page.plans.length, 0)} buttons. Companion is unchanged.`;
  deployStatus.style.color = 'var(--lime)';
  if (overwriteConnected) {
    deviceSelect.value = onlineSurface.id;
    useOfflineTemplate = false;
    offlineWorkspaceExplicitlyActivated = false;
    updateOfflineTemplateState();
    const transfer = compatibleOfflineTransfer(onlineSurface);
    transfer.desiredPageCount = deviceLayers.length;
    await overwriteDeviceLayout(transfer.accepted, transfer, true);
    await syncFromDevice(true);
  }
  setSessionDirty(false);
}

async function loadPreset() {
  try {
    if (typeof window.showOpenFilePicker === 'function') {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'CCB Layout', accept: { 'application/json': ['.ccb-layout', '.json'] } }],
      });
      const file = await handle.getFile();
      const documentValue = JSON.parse(await file.text());
      presetBrowserFileHandle = handle;
      await installPreset(documentValue, { path: '', name: file.name });
      return;
    }
    presetFileInput.click();
  } catch (problem) {
    if (problem.name === 'AbortError' || /user canceled/i.test(problem.message)) return;
    deployStatus.textContent = `Could not load preset: ${problem.message}`; deployStatus.style.color = 'var(--red)';
  }
}
function cacheDevicePlans(deviceId, page, plans) {
  devicePlanCache[devicePlanKey(deviceId, page)] = structuredClone(plans || []);
  localStorage.setItem('device-plan-cache-v2', JSON.stringify(devicePlanCache));
}

function activeDeviceLayer() { return deviceLayers.find((layer) => layer.id === activeDeviceLayerId) || deviceLayers[0]; }

function saveActiveDeviceLayer() {
  const layer = activeDeviceLayer();
  if (!layer) return;
  const plans = surfacePlans();
  // The page field navigates between layers; it must never rename the layer
  // being saved while the user is switching pages.
  layer.model = modelSelect.value;
  layer.deviceId = deviceSelect.value;
  layer.plans = structuredClone(plans);
  cacheDevicePlans(layer.deviceId, layer.page, plans);
  localStorage.setItem('device-layouts-v1', JSON.stringify(deviceLayers));
  localStorage.setItem('active-device-layout', layer.id);
}

function renderDeviceLayerOptions(selectedId = activeDeviceLayer()?.id) {
  deviceLayerSelect.replaceChildren(...deviceLayers.map((layer) => new Option(layer.name, layer.id)));
  deviceLayerSelect.value = selectedId || deviceLayers[0].id;
  activeDeviceLayerId = deviceLayerSelect.value;
  addDeviceLayerButton.disabled = false;
  removeDeviceLayerButton.disabled = deviceLayers.length === 1;
  addDeviceLayerButton.title = deviceSelect.value ? 'Add a layer in Companion' : 'Add an offline Builder layer';
  removeDeviceLayerButton.title = deviceSelect.value ? 'Remove selected layer from Companion' : 'Remove selected offline Builder layer';
  localStorage.setItem('active-device-layout', activeDeviceLayerId);
  updateLayerEdges();
}

function installCompanionLayers(pages) {
  if (!pages.length) return;
  const oldLayers = deviceLayers;
  const activePage = Math.max(1, Number(pageInput.value) || 1);
  const selectedDeviceId = deviceSelect.value;
  deviceLayers = pages.map((page) => {
    const previous = oldLayers.find((layer) => layer.page === page.pageNumber && layer.deviceId === selectedDeviceId);
    return {
      id: `companion-layer-${selectedDeviceId || 'offline'}-${page.pageNumber}`,
      name: page.name || `Layer ${page.pageNumber}`,
      page: page.pageNumber,
      model: previous?.model || modelSelect.value,
      deviceId: selectedDeviceId,
      plans: previous?.plans || cachedDevicePlans(selectedDeviceId, page.pageNumber),
    };
  });
  const selected = deviceLayers.find((layer) => layer.page === activePage) || deviceLayers[0];
  activeDeviceLayerId = selected.id;
  renderDeviceLayerOptions(selected.id);
}

function adjacentDeviceLayer(direction) {
  const index = deviceLayers.findIndex((layer) => layer.id === activeDeviceLayerId);
  return deviceLayers[index + direction] || null;
}

function updateLayerEdges() {
  const previous = adjacentDeviceLayer(-1);
  const next = adjacentDeviceLayer(1);
  layerEdgeLeft?.classList.toggle('available', Boolean(previous));
  layerEdgeLeft?.classList.toggle('unavailable', !previous);
  layerEdgeRight?.classList.toggle('available', Boolean(next));
  layerEdgeRight?.classList.toggle('unavailable', !next);
  if (previousPageButton) previousPageButton.disabled = !previous;
  if (nextPageButton) nextPageButton.disabled = !next;
}

async function navigateAdjacentDeviceLayer(direction, duringDrag = false) {
  const next = adjacentDeviceLayer(direction);
  if (!next || (duringDrag && !activeDragPayload)) return;
  if (duringDrag) crossLayerDragArmed = true;
  saveActiveDeviceLayer();
  activeDeviceLayerId = next.id;
  renderDeviceLayerOptions(next.id);
  await loadDeviceLayer(next);
  deployStatus.textContent = duringDrag ? `${next.name} loaded · keep dragging and drop on an empty key.` : `${next.name} loaded ${deviceSelect.value ? 'from Companion' : 'in the offline Builder'}.`;
  deployStatus.style.color = 'var(--cyan)';
}

function armLayerEdge(edge, direction) {
  edge.addEventListener('dragover', (event) => {
    if (!activeDragPayload || !adjacentDeviceLayer(direction)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    edge.classList.add('drag-hover');
    if (!layerEdgeTimer) layerEdgeTimer = setTimeout(() => {
      layerEdgeTimer = null;
      edge.classList.remove('drag-hover');
      navigateAdjacentDeviceLayer(direction, true);
    }, 650);
  });
  edge.addEventListener('dragleave', () => {
    edge.classList.remove('drag-hover');
    clearTimeout(layerEdgeTimer); layerEdgeTimer = null;
  });
  edge.addEventListener('drop', (event) => {
    event.preventDefault();
    edge.classList.remove('drag-hover');
    clearTimeout(layerEdgeTimer); layerEdgeTimer = null;
    if (activeDragPayload && !crossLayerDragArmed && adjacentDeviceLayer(direction)) navigateAdjacentDeviceLayer(direction, true);
  });
  edge.addEventListener('click', () => navigateAdjacentDeviceLayer(direction, false));
}

async function loadDeviceLayer(layer) {
  if (!layer) return;
  // An unconfirmed preview belongs only to the layer where it was generated.
  // Clear it before hydrating the selected layer so the restored plans are the
  // sole source rendered by surfacePlans().
  pendingButtonPreview = false;
  previewBasePlans = [];
  pageInput.value = String(layer.page);
  modelSelect.value = layer.model || 'offline:mk2';
  deviceSelect.value = connectedSurfaces.some((surface) => surface.id === layer.deviceId && surface.connected !== false) ? layer.deviceId : '';
  useOfflineTemplate = !deviceSelect.value;
  updateOfflineTemplateState();
  if (useOfflineTemplate) {
    existingButtons = [];
    existingButtonsPage = layer.page;
    lastButtonsRefresh = 0;
  }
  currentPlans = structuredClone(layer.plans || []);
  currentPlan = currentPlans.find((plan) => plan.button.location.page === layer.page) || null;
  previewToggleState = 'unmuted';
  if (!currentPlan) {
    result.classList.add('hidden'); error.classList.add('hidden'); empty.classList.remove('hidden');
    validation.textContent = `${layer.name} · ready`; validation.style.color = '';
  } else {
    validation.textContent = `${layer.name} · ${currentPlans.length} planned button${currentPlans.length === 1 ? '' : 's'}`;
    validation.style.color = 'var(--cyan)';
  }
  updateLayerEdges();
  renderSurface();
  await refreshExistingButtons(layer.page, true);
  renderSurface();
  await followSelectedLayerOnDevice(layer);
}

async function followSelectedLayerOnDevice(layer) {
  const surface = selectedSurface();
  if (!companionOnline || !surface?.id || surface.offline || surface.connected === false) return;
  try {
    const response = await fetch('/api/companion-surface-page', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: addressInput.value.trim(), surfaceId: surface.id, pageNumber: layer.page }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
  } catch (problem) {
    deployStatus.textContent = `Preview changed to ${layer.name}, but the Stream Deck could not follow: ${problem.message}`;
    deployStatus.style.color = 'var(--red)';
  }
}

function selectedSurface() {
  if (deviceSelect.value && workspaceSurfaceIds.has(deviceSelect.value)) return connectedSurfaces.find((surface) => surface.id === deviceSelect.value) || null;
  const offlineId = workspaceSurfaceIds.has(modelSelect.value)
    ? modelSelect.value
    : [...workspaceSurfaceIds].find((id) => String(id).startsWith('offline:')) || '';
  if (!offlineId) return null;
  const key = offlineId.replace(/^offline:/, '');
  return { ...MODELS[key], id: offlineId, model: offlineId, xOffset: 0, yOffset: 0, offline: true };
}

function workspaceSurface(id) {
  const online = connectedSurfaces.find((surface) => surface.id === id);
  if (online) return online;
  if (!String(id).startsWith('offline:')) return null;
  const model = MODELS[String(id).replace(/^offline:/, '')];
  return model ? { ...model, id, model: id, xOffset: 0, yOffset: 0, offline: true, connected: true } : null;
}

function workspaceCacheKey(surfaceId, page) { return `${surfaceId}:${page}`; }
function offlineWorkspacePlanKey(surfaceId, page) { return `offline:${surfaceId}:${page}`; }

function selectedWorkspaceSurfaces() {
  return [...workspaceSurfaceIds].map(workspaceSurface).filter((surface) => surface && (surface.offline || surface.connected !== false));
}

function persistWorkspaceSelection() {
  localStorage.setItem('ccb-workspace-surfaces', JSON.stringify([...workspaceSurfaceIds]));
  localStorage.setItem('ccb-workspace-pages', JSON.stringify(workspacePages));
}

function workspacePage(surfaceId, fallback = viewedPage()) { return Math.max(1, Number(workspacePages[surfaceId]) || fallback); }

async function changeWorkspacePage(surface, direction) {
  const next = Math.max(1, workspacePage(surface.id) + direction);
  workspacePages[surface.id] = next; persistWorkspaceSelection();
  if (!surface.offline) {
    await refreshWorkspaceButtonCaches(next);
    fetch('/api/companion-surface-page', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), surfaceId: surface.id, pageNumber: next }) }).catch(() => {});
  }
  renderSurface();
}

function workspaceLabel(surface) {
  return `${surface.name} · ${surface.columns}×${surface.rows}${surface.offline ? ' · Offline' : surface.satellite ? ' · Satellite' : ' · Online'}`;
}

function renderWorkspacePicker() {
  const onlineSurfaces = connectedSurfaces.filter((surface) => surface.connected !== false);
  if (workspacePicker.nextElementSibling) workspacePicker.nextElementSibling.textContent = onlineSurfaces.length
    ? 'Mix connected devices and offline templates; online enrollment keeps its sync-direction prompt'
    : 'No physical devices detected · choose an offline template';
  const offlineSurfaces = Object.entries(MODELS).map(([id, model]) => ({ ...model, id: `offline:${id}`, offline: true, connected: true }));
  const available = [...onlineSurfaces, ...offlineSurfaces];
  workspaceDeviceOptions.replaceChildren();
  for (const surface of available) {
    const label = document.createElement('label');
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = workspaceSurfaceIds.has(surface.id); input.value = surface.id;
    const text = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = surface.name;
    const detail = document.createElement('small'); detail.textContent = `${surface.columns}×${surface.rows} · ${surface.offline ? 'Offline template' : surface.satellite ? 'Companion Satellite' : 'Connected to Companion'}`;
    text.append(name, detail); label.append(input, text); workspaceDeviceOptions.append(label);
    input.addEventListener('change', async () => {
      const newlySelectedOnlineSurface = input.checked && !surface.offline && !workspaceSurfaceIds.has(surface.id);
      const activeBefore = selectedSurface()?.id || '';
      const selection = toggleWorkspaceSurfaceSelection([...workspaceSurfaceIds], surface.id, input.checked, activeBefore);
      workspaceSurfaceIds = new Set(selection.selectedIds);
      persistWorkspaceSelection();
      if (newlySelectedOnlineSurface) {
        workspacePendingSelectionId = surface.id;
        await activateWorkspaceSurface(surface.id, { promptSync: true });
      }
      else if (selection.nextActiveId && selection.nextActiveId !== activeBefore) await activateWorkspaceSurface(selection.nextActiveId);
      else if (!selection.nextActiveId) {
        saveActiveDeviceLayer();
        deviceSelect.value = '';
        selectedGridItem = null;
        finishDragInteraction();
        useOfflineTemplate = true;
        localStorage.setItem('use-offline-template', 'true');
        updateOfflineTemplateState();
      }
      if (!surface.offline && input.checked) await refreshWorkspaceButtonCaches(viewedPage());
      renderWorkspacePicker(); renderSurface();
    });
  }
  const chosen = selectedWorkspaceSurfaces();
  workspaceDeviceSummary.textContent = chosen.length ? `${chosen.length} surface${chosen.length === 1 ? '' : 's'} in workspace` : 'Choose surfaces…';
}

async function activateWorkspaceSurface(surfaceId, { promptSync = false } = {}) {
  const surface = workspaceSurface(surfaceId);
  if (!surface) return;
  workspaceSurfaceIds.add(surfaceId); persistWorkspaceSelection();
  if (!surface.offline) {
    offlineWorkspaceExplicitlyActivated = false;
    deviceSwitchPromptRequested = promptSync;
    deviceSelect.value = surface.id;
    deviceSelect.dispatchEvent(new Event('change'));
    return;
  }
  saveActiveDeviceLayer();
  offlineWorkspaceExplicitlyActivated = true;
  deviceSelect.value = '';
  modelSelect.value = surface.id;
  useOfflineTemplate = true;
  localStorage.setItem('surface-model', surface.id);
  localStorage.setItem('use-offline-template', 'true');
  const prefix = `offline:${surface.id}:`;
  const pages = Object.keys(devicePlanCache).filter((key) => key.startsWith(prefix)).map((key) => Number(key.slice(prefix.length))).filter(Number.isInteger).sort((a, b) => a - b);
  const availablePages = pages.length ? pages : [1];
  deviceLayers = availablePages.map((page) => ({ id: `offline-workspace-${surface.id}-${page}`, name: `Layer ${page}`, page, model: surface.id, deviceId: '', plans: structuredClone(devicePlanCache[offlineWorkspacePlanKey(surface.id, page)] || []) }));
  activeDeviceLayerId = deviceLayers[0].id;
  renderDeviceLayerOptions(activeDeviceLayerId);
  await loadDeviceLayer(deviceLayers[0]);
  renderWorkspacePicker();
}

function continueStartupSurfaceSync() {
  if (deviceSwitchInProgress) return;
  const surfaceId = startupSurfaceSyncQueue.shift();
  if (!surfaceId) return;
  if (!connectedSurfaces.some((surface) => surface.id === surfaceId && surface.connected !== false)) {
    queueMicrotask(continueStartupSurfaceSync);
    return;
  }
  activateWorkspaceSurface(surfaceId, { promptSync: true });
}

function promptStartupSurfaceSync(surfaces) {
  if (startupSurfaceSyncInitialized || !surfaces.length) return;
  startupSurfaceSyncInitialized = true;
  startupSurfaceSyncQueue = surfaces.map((surface) => surface.id);
  continueStartupSurfaceSync();
}

async function refreshWorkspaceButtonCaches(page = viewedPage()) {
  const online = selectedWorkspaceSurfaces().filter((surface) => !surface.offline && surface.connected !== false);
  if (!companionOnline || !online.length) return;
  try {
    const response = await fetch(`/api/companion-buttons?address=${encodeURIComponent(addressInput.value.trim())}&page=${page}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    await Promise.all(online.map(async (surface) => {
      const buttons = (data.buttons || []).filter((button) => button.row >= surface.yOffset && button.row < surface.yOffset + surface.rows && button.column >= surface.xOffset && button.column < surface.xOffset + surface.columns);
      try {
        const graphicsResponse = await fetch(`/api/companion-button-graphics?address=${encodeURIComponent(addressInput.value.trim())}&surfaceId=${encodeURIComponent(surface.id)}&page=${page}`);
        const graphicsData = await graphicsResponse.json();
        if (graphicsResponse.ok) {
          const graphics = new Map((graphicsData.graphics || []).map((graphic) => [`${graphic.row + surface.yOffset - 1}/${graphic.column + surface.xOffset - 1}`, graphic.image]));
          for (const button of buttons) button.image = graphics.get(`${button.row}/${button.column}`) || button.image;
        }
      } catch {}
      workspaceButtonCache.set(workspaceCacheKey(surface.id, page), structuredClone(buttons));
    }));
  } catch {}
}

function workspacePlans(surface, page) {
  if (surface.offline) {
    if (selectedSurface()?.id === surface.id) return surfacePlans().filter((plan) => plan.button.location.page === page);
    return structuredClone(devicePlanCache[offlineWorkspacePlanKey(surface.id, page)] || []);
  }
  if (selectedSurface()?.id === surface.id) return surfacePlans().filter((plan) => plan.button.location.page === page);
  return cachedDevicePlans(surface.id, page).filter((plan) => plan.button.location.page === page);
}

function workspaceButtons(surface, page) {
  if (surface.offline) return [];
  if (selectedSurface()?.id === surface.id && existingButtonsPage === page) return existingButtons;
  return workspaceButtonCache.get(workspaceCacheKey(surface.id, page)) || [];
}

function startWorkspaceDrag(event, payload, key) {
  buttonClipboard = payload;
  activeDragPayload = { workspace: true, clipboard: payload };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `workspace:${payload.type}`);
  event.dataTransfer.setDragImage(key, key.clientWidth / 2, key.clientHeight / 2);
  key.classList.add('dragging');
}

async function dropWorkspaceButton(targetSurface, target) {
  const clipboard = activeDragPayload?.clipboard || buttonClipboard;
  if (!clipboard) return;
  deployStatus.textContent = `Moving “${clipboard.label}” to ${targetSurface.name} ${target.page}/${target.row}/${target.column}…`;
  deployStatus.style.color = 'var(--cyan)';
  try {
    if (clipboard.type === 'companion') {
      if (targetSurface.offline) throw new Error('A live Companion control cannot be converted to an offline plan without its complete module schema. Copy it to another connected surface instead.');
      const response = await fetch('/api/companion-button-transfer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), mode: clipboard.mode, sourceSurfaceId: clipboard.sourceSurfaceId, targetSurfaceId: targetSurface.id, source: clipboard.source, target }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
    } else {
      const plan = structuredClone(clipboard.plan); plan.button.location = target;
      if (targetSurface.offline) {
        const key = offlineWorkspacePlanKey(targetSurface.id, target.page);
        const plans = structuredClone(devicePlanCache[key] || []);
        if (plans.some((item) => item.button.location.row === target.row && item.button.location.column === target.column)) throw new Error('That offline destination is occupied.');
        plans.push(plan); devicePlanCache[key] = plans;
        localStorage.setItem('device-plan-cache-v2', JSON.stringify(devicePlanCache));
        if (selectedSurface()?.id === targetSurface.id) { currentPlans = plans; saveActiveDeviceLayer(); }
      } else {
        const response = await fetch('/api/deploy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plans: [plan], address: addressInput.value.trim(), surfaceId: targetSurface.id }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
      }
      if (clipboard.mode === 'cut') removeCutPlannedSource(clipboard);
    }
    if (clipboard.mode === 'cut') buttonClipboard = null;
    activeDragPayload = null;
    for (const page of moveRefreshPages(clipboard.mode === 'cut' ? clipboard.source?.page : null, target.page)) await refreshWorkspaceButtonCaches(page);
    if (selectedSurface()?.id === targetSurface.id && !targetSurface.offline) await refreshExistingButtons(target.page, true);
    else if (clipboard.mode === 'cut' && selectedSurface()?.id === clipboard.sourceSurfaceId) await refreshExistingButtons(clipboard.source.page, true);
    deployStatus.textContent = `Moved “${clipboard.label}” to ${targetSurface.name} at ${target.page}/${target.row}/${target.column}.`;
    deployStatus.style.color = 'var(--lime)';
    setSessionDirty(true); renderSurface();
  } catch (problem) {
    deployStatus.textContent = `Workspace move failed: ${problem.message}`; deployStatus.style.color = 'var(--red)';
    activeDragPayload = null; renderSurface();
  }
}

function renderPassiveWorkspaceGrid(grid, surface, page) {
  const plans = workspacePlans(surface, page);
  const buttons = workspaceButtons(surface, page);
  const visualKind = surfaceVisualKind(surface);
  grid.classList.toggle('has-touch-strip', visualKind === 'streamdeck-plus');
  grid.classList.toggle('has-encoders', visualKind !== 'buttons');
  grid.style.gridTemplateColumns = `repeat(${surface.columns}, minmax(0, 1fr))`;
  for (let localRow = 1; localRow <= surface.rows; localRow += 1) for (let localColumn = 1; localColumn <= surface.columns; localColumn += 1) {
    const row = surface.offline ? localRow - 1 : localRow + surface.yOffset - 1;
    const column = surface.offline ? localColumn - 1 : localColumn + surface.xOffset - 1;
    const locationLabel = `${page}/${row}/${column}`;
    const cell = document.createElement('div'); cell.className = 'surface-cell';
    const key = document.createElement('div'); key.className = 'surface-key'; key.setAttribute('role', 'gridcell'); key.setAttribute('aria-label', locationLabel); key.dataset.ccbLocation = locationLabel;
    const encoder = surfaceHasRotaryControls(surface) && ((visualKind === 'streamdeck-studio' && localRow === 1 && (localColumn === 1 || localColumn === surface.columns)) || (visualKind === 'streamdeck-plus' && localRow === surface.rows));
    const touchStrip = visualKind === 'streamdeck-plus' && localRow === surface.rows - 1;
    if (encoder) key.classList.add('physical-encoder');
    if (touchStrip) { key.classList.add('touch-strip-segment'); if (localColumn === 1) key.classList.add('touch-strip-first'); if (localColumn === surface.columns) key.classList.add('touch-strip-last'); }
    const existing = buttons.find((button) => button.row === row && button.column === column);
    const planned = plans.find((plan) => plan.button.location.row === row && plan.button.location.column === column);
    if (existing) {
      key.classList.add('existing'); key.style.background = existing.backgroundColor; key.style.color = existing.textColor;
      if (existing.image) installGridGraphic(key, existing.image, existing.text || 'Companion button', { controlId: existing.controlId || '' });
      else key.textContent = existing.text || 'BUTTON';
      key.draggable = true;
      key.addEventListener('dragstart', (event) => startWorkspaceDrag(event, { type: 'companion', mode: 'cut', label: existing.text || 'Companion button', sourceSurfaceId: surface.id, source: { page, row, column } }, key));
    } else if (planned) {
      key.classList.add('active'); const appearance = planned.button.appearance?.states?.unmuted || planned.button.appearance || {};
      key.style.background = appearance.backgroundColor; key.style.color = appearance.textColor; key.textContent = planned.button.text;
      key.draggable = true;
      key.addEventListener('dragstart', (event) => startWorkspaceDrag(event, { type: 'planned', mode: 'cut', label: planned.button.text.replace(/\n/g, ' '), plan: structuredClone(planned), sourceLayerId: '', sourcePlanKey: surface.offline ? offlineWorkspacePlanKey(surface.id, page) : devicePlanKey(surface.id, page), source: { page, row, column } }, key));
      key.addEventListener('click', async () => {
        if (!surface.offline) return;
        if (selectedSurface()?.id !== surface.id) await activateWorkspaceSurface(surface.id);
        const selectedPlan = findPlanAtLocation(surfacePlans(), { page, row, column });
        if (!selectedPlan) {
          deployStatus.textContent = `Could not open offline button ${page}/${row}/${column}; its workspace cache is out of date.`;
          deployStatus.style.color = 'var(--red)';
          return;
        }
        selectGridItem({ type: 'planned', page, row, column });
      });
    } else {
      key.addEventListener('dragover', (event) => { if (!activeDragPayload) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; key.classList.add('drop-target'); });
      key.addEventListener('dragleave', () => key.classList.remove('drop-target'));
      key.addEventListener('drop', (event) => { event.preventDefault(); key.classList.remove('drop-target'); dropWorkspaceButton(surface, { page, row, column }); });
    }
    const coordinate = document.createElement('small'); coordinate.className = 'surface-key-coordinate'; coordinate.textContent = locationLabel; cell.append(coordinate, key); grid.append(cell);
  }
}

function renderWorkspaceSurfaces() {
  if (!workspaceSurfaces) return;
  const active = selectedSurface();
  const activeId = active?.id || '';
  for (const old of workspaceSurfaces.querySelectorAll('.workspace-surface.passive')) old.remove();
  if (!active) {
    activeWorkspaceName.textContent = 'No surface selected';
    workspaceSurfaces.classList.remove('inter-grid-navigation');
    document.querySelector('.surface')?.classList.remove('workspace-expanded');
    toggleWorkspaceViewButton.textContent = workspaceViewEnabled ? '▦ Surface View: Workspace' : '▣ Surface View: Single';
    toggleWorkspaceViewButton.setAttribute('aria-pressed', String(workspaceViewEnabled));
    toggleWorkspaceViewButton.classList.toggle('active', workspaceViewEnabled);
    renderWorkspacePicker();
    return;
  }
  workspacePages[activeId] = viewedPage();
  persistWorkspaceSelection();
  activeWorkspaceName.textContent = `${active?.name || 'Offline template'} · ${active?.columns || 0}×${active?.rows || 0}`;
  const visibleSurfaces = workspaceViewEnabled ? selectedWorkspaceSurfaces() : [active];
  const showNextLayoutBetweenSurfaces = visibleSurfaces.length > 1;
  workspaceSurfaces.classList.toggle('inter-grid-navigation', showNextLayoutBetweenSurfaces);
  if (layerEdgeRight) {
    if (showNextLayoutBetweenSurfaces) {
      document.querySelector('#active-workspace-surface')?.after(layerEdgeRight);
    } else {
      document.querySelector('.surface-stage')?.append(layerEdgeRight);
    }
  }
  document.querySelector('.surface')?.classList.toggle('workspace-expanded', visibleSurfaces.length > 1);
  toggleWorkspaceViewButton.textContent = workspaceViewEnabled ? '▦ Surface View: Workspace' : '▣ Surface View: Single';
  toggleWorkspaceViewButton.setAttribute('aria-pressed', String(workspaceViewEnabled));
  toggleWorkspaceViewButton.classList.toggle('active', workspaceViewEnabled);
  for (const surface of visibleSurfaces) {
    if (surface.id === activeId) continue;
    const article = document.createElement('article'); article.className = 'workspace-surface passive'; article.dataset.surfaceId = surface.id;
    const page = workspacePage(surface.id);
    const header = document.createElement('header'); const name = document.createElement('strong'); name.textContent = workspaceLabel(surface);
    const pageControls = document.createElement('span'); pageControls.className = 'workspace-page-controls';
    const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '‹'; previous.disabled = page <= 1; previous.title = 'Previous page'; previous.addEventListener('click', () => changeWorkspacePage(surface, -1));
    const pageLabel = document.createElement('small'); pageLabel.textContent = `PAGE ${page}`;
    const next = document.createElement('button'); next.type = 'button'; next.textContent = '›'; next.title = 'Next page'; next.addEventListener('click', () => changeWorkspacePage(surface, 1));
    pageControls.append(previous, pageLabel, next);
    const activate = document.createElement('button'); activate.type = 'button'; activate.textContent = 'Make Active'; activate.addEventListener('click', () => activateWorkspaceSurface(surface.id));
    header.append(name, pageControls, activate);
    const shell = document.createElement('div'); shell.className = 'device-shell'; const grid = document.createElement('div'); grid.className = 'surface-grid'; grid.setAttribute('role', 'grid'); shell.append(grid); article.append(header, shell); workspaceSurfaces.append(article);
    renderPassiveWorkspaceGrid(grid, surface, page);
  }
  renderWorkspacePicker();
}

function surfaceHasRotaryControls(surface = selectedSurface()) {
  const type = String(surface?.type || surface?.name || '').toLowerCase();
  return type.includes('stream deck +') || type.includes('stream deck plus') || type.includes('stream deck studio');
}

function surfaceVisualKind(surface = selectedSurface()) {
  const type = String(surface?.type || surface?.name || '').toLowerCase();
  if (type.includes('stream deck +') || type.includes('stream deck plus')) return 'streamdeck-plus';
  if (type.includes('stream deck studio')) return 'streamdeck-studio';
  return 'buttons';
}

function updateQuickActionState() {
  const surface = selectedSurface();
  const ready = Boolean(companionOnline && surface?.id && !surface.offline && surface.connected !== false);
  const page = Math.max(1, Number(pageInput.value) || 1);
  const offlineClearable = Boolean(surface?.offline && currentPlans.some((plan) => plan.button.location.page === page));
  clearDevicePageButton.disabled = !(ready || offlineClearable);
  addLayerScrollButton.disabled = !ready;
  initializeEncodersButton.disabled = !ready || !surfaceHasRotaryControls(surface);
  initializeEncodersButton.title = surfaceHasRotaryControls(surface) ? 'Enable rotary-left, rotary-right, and encoder push support' : 'The selected device has no supported physical encoder row';
}

function finishDragInteraction() {
  activeDragPayload = null;
  crossLayerDragArmed = false;
  clearTimeout(layerEdgeTimer); layerEdgeTimer = null;
  document.querySelectorAll('.dragging,.drop-target,.drag-hover').forEach((element) => element.classList.remove('dragging', 'drop-target', 'drag-hover'));
}

function finishOrCarryDrag(event, key) {
  key.classList.remove('dragging');
  if (!activeDragPayload) return;
  if (!crossLayerDragArmed) { finishDragInteraction(); return; }
  const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.surface-key');
  const row = Number(destination?.dataset.row);
  const column = Number(destination?.dataset.column);
  if (destination && Number.isInteger(row) && Number.isInteger(column)) {
    dropActiveButton(row, column);
    return;
  }
  deployStatus.textContent = `${activeDeviceLayer().name} loaded · select an empty key to place the carried button.`;
  deployStatus.style.color = 'var(--cyan)';
  renderSurface();
}

function cancelMovePreview() {
  if (currentPlan?.kind !== 'move-button') return;
  currentPlans = currentPlans.filter((plan) => plan !== currentPlan && plan.kind !== 'move-button');
  currentPlan = currentPlans[0] || null;
  saveActiveDeviceLayer();
  setPushButton();
  finishDragInteraction();
  renderSurface();
}

function viewedPage() { return currentPlan?.button.location.page || Math.max(1, Number(pageInput.value) || 1); }

function compatibility() {
  const selected = selectedSurface();
  if (!currentPlans.length || !selected) return { compatible: false, surface: null };
  if (selected.offline) {
    const compatible = currentPlans.every(({ button: { location } }) => fitsSurfaceGrid(selected, location, { local: true }));
    return { compatible, surface: selected };
  }
  const surface = resolvePlanTargetSurface(connectedSurfaces, currentPlans, selected.id);
  return { compatible: Boolean(surface), surface, selectedSurface: selected };
}

function previewAppearance() {
  const appearance = currentPlan?.button?.appearance;
  return appearance?.states?.[previewToggleState] || appearance || null;
}

function applyPreviewAppearance() {
  const appearance = previewAppearance();
  const previewKey = document.querySelector('#deck-button');
  if (!appearance || !previewKey) return;
  // While the quick editor is open its controls are the draft source of truth.
  // Do not let a toggle refresh repaint the previous stored state over them.
  if (previewKey.classList.contains('quick-simulated')) {
    previewKey.style.background = quickBackgroundColor.value;
    previewKey.style.color = quickTextColor.value;
    previewKey.style.borderColor = 'transparent';
    previewKey.style.boxShadow = 'none';
    return;
  }
  previewKey.style.background = appearance.backgroundColor;
  previewKey.style.color = appearance.textColor;
  previewKey.style.borderColor = 'transparent';
  previewKey.style.boxShadow = 'none';
  const interactive = Boolean(currentPlan?.button?.appearance?.states);
  previewKey.classList.toggle('toggleable-preview', interactive);
  previewKey.setAttribute('aria-pressed', interactive ? String(previewToggleState === 'muted') : 'false');
  previewKey.title = interactive ? `Previewing ${previewToggleState} state · click to toggle` : '';
}

function renderBatchList() {
  const batchSummary = document.querySelector('#batch-summary');
  const batchList = document.querySelector('#batch-list');
  batchSummary.classList.toggle('hidden', currentPlans.length < 2);
  batchList.replaceChildren(...currentPlans.map((item, index) => {
    const row = document.createElement('li');
    const spot = item.button.location;
    const appearance = item.button.appearance?.states?.unmuted || item.button.appearance || {};
    const key = document.createElement('div');
    key.className = 'batch-preview-key';
    key.style.background = appearance.backgroundColor || '#000000';
    key.style.color = appearance.textColor || '#ffffff';
    key.textContent = item.button.text.replace(/\n/g, ' ');
    const details = document.createElement('span');
    details.innerHTML = `<strong>${index + 1}. ${spot.page}/${spot.row}/${spot.column}</strong><small>${item.button.behavior || item.button.action?.operation || 'Button action'}</small>`;
    row.append(key, details);
    return row;
  }));
}

function clearButtonPreview({ preservePlans = false } = {}) {
  currentPlan = null;
  if (!preservePlans) currentPlans = [];
  previewBasePlans = [];
  pendingButtonPreview = false;
  previewToggleState = 'unmuted';
  quickPreviewExactSource = null;
  quickPreviewRecolorToken += 1;
  document.querySelector('#button-render').classList.add('hidden');
  document.querySelector('#deck-button').classList.remove('exact-render', 'toggleable-preview', 'quick-simulated');
  delete document.querySelector('#deck-button').dataset.ccbLocation;
  document.querySelector('#deck-button').style.boxShadow = '';
  document.querySelector('#button-channel').style.cssText = '';
  document.querySelector('#button-action').style.cssText = '';
  document.querySelector('#action-manifest').replaceChildren();
  document.querySelector('#batch-list').replaceChildren();
  document.querySelector('#batch-summary').classList.add('hidden');
  document.querySelector('#state-colors-label').classList.add('hidden');
  document.querySelector('#state-colors').classList.add('hidden');
  result.classList.add('hidden');
  error.classList.add('hidden');
  empty.classList.remove('hidden');
  confirmAddButton.classList.add('hidden');
  updatePreviewButton.classList.add('hidden');
  quickButtonEditor.classList.add('hidden');
  setPushButton();
}

function surfacePlans() {
  return pendingButtonPreview ? previewBasePlans : currentPlans;
}

function confirmPendingButtonsOffline() {
  const surface = selectedSurface();
  if (!surface?.offline || !pendingButtonPreview || !currentPlans.length) return;
  const occupied = new Set(previewBasePlans.map((plan) => {
    const location = plan.button.location;
    return `${location.page}/${location.row}/${location.column}`;
  }));
  const collision = currentPlans.find((plan) => {
    const location = plan.button.location;
    return occupied.has(`${location.page}/${location.row}/${location.column}`);
  });
  if (collision) {
    const location = collision.button.location;
    deployStatus.textContent = `${location.page}/${location.row}/${location.column} is already occupied in the offline layout.`;
    deployStatus.style.color = 'var(--red)';
    return;
  }
  const added = currentPlans.length;
  currentPlans = [...previewBasePlans, ...currentPlans];
  pendingButtonPreview = false;
  saveActiveDeviceLayer();
  clearButtonPreview({ preservePlans: true });
  validation.textContent = added > 1 ? `${added} buttons added to the Builder layer` : 'Button added to the Builder layer';
  validation.style.color = 'var(--lime)';
  deployStatus.textContent = added > 1 ? `${added} previewed buttons were added to the offline layer.` : 'The previewed button was added to the offline layer.';
  deployStatus.style.color = 'var(--lime)';
  setSessionDirty(true);
  renderSurface();
  updateDeployState();
}

function movePlannedButton(planIndex, row, column) {
  const plan = currentPlans[planIndex];
  if (!plan) return;
  const page = plan.button.location.page;
  const collision = currentPlans.some((item, index) => index !== planIndex && item.button.location.page === page && item.button.location.row === row && item.button.location.column === column);
  const occupied = existingButtonsPage === page && existingButtons.some((item) => item.row === row && item.column === column);
  if (collision || occupied) {
    const warning = document.querySelector('#surface-warning');
    warning.textContent = `${page}/${row}/${column} is already occupied. Choose an empty key.`;
    warning.classList.remove('hidden');
    return;
  }
  plan.button.location.row = row;
  plan.button.location.column = column;
  if (plan === currentPlan) document.querySelector('#button-location').textContent = `Page ${page} · Row ${row} · Column ${column}`;
  renderBatchList();
  saveActiveDeviceLayer();
  deployStatus.textContent = `Moved button to ${page}/${row}/${column}. Builder layout is ready to push.`;
  deployStatus.style.color = 'var(--cyan)';
  renderSurface();
}

function previewExistingMove(existing, row, column, sourcePage = viewedPage(), sourceLayerId = activeDeviceLayerId) {
  const page = viewedPage();
  if (sourcePage === page && sourceLayerId === activeDeviceLayerId && existing.row === row && existing.column === column) return;
  const occupied = existingButtons.some((item) => item.row === row && item.column === column);
  if (occupied) {
    const warning = document.querySelector('#surface-warning');
    warning.textContent = `${page}/${row}/${column} is already occupied. Drop the button on an empty key.`;
    warning.classList.remove('hidden');
    return;
  }
  currentPlan = {
    kind: 'move-button',
    button: {
      location: { page, row, column },
      text: existing.text || 'BUTTON',
      image: existing.image || null,
      controlId: existing.controlId || null,
      appearance: { textColor: existing.textColor, backgroundColor: existing.backgroundColor },
      action: { family: 'existing', operation: 'preserve' },
    },
    move: { from: { page: sourcePage, row: existing.row, column: existing.column }, sourceLayerId, targetLayerId: activeDeviceLayerId },
    actions: [{ step: '—', actionId: 'preserved', summary: 'Move original Companion control; preserve all programming' }],
    ai: null,
  };
  currentPlans = [currentPlan];
  saveActiveDeviceLayer();
  const parts = currentPlan.button.text.split('\n');
  document.querySelector('#button-channel').textContent = parts[0];
  document.querySelector('#button-action').textContent = parts.slice(1).join(' ');
  document.querySelector('#button-location').textContent = `Page ${page} · Row ${row} · Column ${column}`;
  document.querySelector('#behavior').textContent = `Move from ${sourcePage}/${existing.row}/${existing.column} on ${deviceLayers.find((layer) => layer.id === sourceLayerId)?.name || 'source layout'} to ${page}/${row}/${column} on ${activeDeviceLayer().name} · preserve all programming`;
  document.querySelector('#action-manifest').replaceChildren(...currentPlan.actions.map((item) => {
    const entry = document.createElement('li'); entry.textContent = `${item.summary} · ${item.actionId}`; return entry;
  }));
  const rendered = document.querySelector('#button-render');
  const previewKey = document.querySelector('#deck-button');
  previewKey.dataset.ccbLocation = `${page}/${row}/${column}`;
  if (existing.image) { rendered.src = existing.image; rendered.classList.remove('hidden'); previewKey.classList.add('exact-render'); }
  else { rendered.classList.add('hidden'); previewKey.classList.remove('exact-render'); applyPreviewAppearance(); }
  document.querySelector('#state-colors-label').classList.add('hidden');
  document.querySelector('#state-colors').classList.add('hidden');
  document.querySelector('#target-instance').textContent = addressInput.value.trim();
  document.querySelector('#batch-summary').classList.add('hidden');
  empty.classList.add('hidden'); error.classList.add('hidden'); result.classList.remove('hidden');
  validation.textContent = 'Existing button move · original programming preserved'; validation.style.color = 'var(--lime)';
  setPushButton('Move Button in Companion', 'Apply the reviewed Builder move');
  deployStatus.textContent = `Move preview ready: ${sourcePage}/${existing.row}/${existing.column} → ${page}/${row}/${column}.`;
  deployStatus.style.color = 'var(--cyan)';
  renderSurface();
  if (companionOnline && !selectedSurface()?.offline) {
    deployStatus.textContent = `Moving ${sourcePage}/${existing.row}/${existing.column} → ${page}/${row}/${column} in Companion…`;
    setTimeout(() => deploy(), 0);
  }
}

function dropActiveButton(row, column) {
  const payload = activeDragPayload;
  if (!payload) return;
  if (payload.type === 'existing') {
    previewExistingMove(payload.existing, row, column, payload.sourcePage, payload.sourceLayerId);
  } else if (payload.type === 'planned') {
    if (payload.sourceLayerId === activeDeviceLayerId) movePlannedButton(payload.planIndex, row, column);
    else {
      const page = viewedPage();
      const occupied = existingButtons.some((item) => item.row === row && item.column === column)
        || currentPlans.some((item) => item.button.location.page === page && item.button.location.row === row && item.button.location.column === column);
      if (occupied) {
        const warning = document.querySelector('#surface-warning');
        warning.textContent = `${page}/${row}/${column} is already occupied. Choose an empty key.`;
        warning.classList.remove('hidden');
      } else {
        const sourceLayer = deviceLayers.find((layer) => layer.id === payload.sourceLayerId);
        if (sourceLayer) {
          sourceLayer.plans.splice(payload.planIndex, 1);
          cacheDevicePlans(sourceLayer.deviceId || '', sourceLayer.page, sourceLayer.plans);
        }
        const plan = structuredClone(payload.plan);
        plan.button.location = { page, row, column };
        currentPlans.push(plan);
        currentPlan = plan;
        saveActiveDeviceLayer();
        localStorage.setItem('device-layouts-v1', JSON.stringify(deviceLayers));
        deployStatus.textContent = `Button moved to ${activeDeviceLayer().name} at ${page}/${row}/${column}.`;
        deployStatus.style.color = 'var(--cyan)';
        renderSurface();
      }
    }
  }
  finishDragInteraction();
}

function updateDeployState() {
  const selected = selectedSurface();
  const target = compatibility();
  deployButton.disabled = !(currentPlans.length && companionOnline && target.surface && !target.surface.offline && target.surface.connected !== false && target.compatible);
  const canConfirmOffline = Boolean(currentPlans.length && currentPlan?.kind === 'create-button' && selected?.offline && compatibility().compatible);
  const canConfirmOnline = Boolean(currentPlans.length && currentPlan?.kind === 'create-button' && companionOnline && target.surface && !target.surface.offline && target.surface.connected !== false && target.compatible);
  confirmAddButton.disabled = !(canConfirmOffline || canConfirmOnline);
  updatePreviewButton.disabled = !(['edit-button', 'replace-button'].includes(currentPlan?.kind) && companionOnline && target.surface && !target.surface.offline && target.surface.connected !== false && target.compatible);
  const offlinePlans = allOfflinePlans();
  const transfer = selected && !selected.offline ? compatibleOfflineTransfer(selected, offlinePlans) : { accepted: [], skipped: [] };
  mergeDeviceLayoutButton.disabled = !(companionOnline && selected && !selected.offline && selected.connected !== false && transfer.accepted.length);
  mergeDeviceLayoutButton.querySelector('small').textContent = offlinePlans.length ? `Place up to ${transfer.accepted.length} compatible button${transfer.accepted.length === 1 ? '' : 's'} in empty spaces` : 'No saved offline layout available';
  overwriteDeviceLayoutButton.disabled = !(companionOnline && selected && !selected.offline && selected.connected !== false && transfer.accepted.length);
  overwriteDeviceLayoutButton.querySelector('small').textContent = offlinePlans.length ? `Replace with ${transfer.accepted.length} compatible button${transfer.accepted.length === 1 ? '' : 's'}${transfer.skipped.length ? ` · skip ${transfer.skipped.length}` : ''}` : 'No saved offline layout available';
  updateQuickActionState();
}

async function mergeDeviceLayout(confirmed = false) {
  const surface = selectedSurface();
  const transfer = surface?.id ? compatibleOfflineTransfer(surface) : null;
  const plans = transfer?.accepted || [];
  if (!surface?.id || surface.offline || !plans.length) return;
  const warning = `MERGE INTO ${surface.name}?\n\nBuilder will preserve every existing Companion button and place up to ${plans.length} compatible offline-template button${plans.length === 1 ? '' : 's'} into empty positions across the device’s existing layers. Template positions are retained when available; occupied positions are relocated to the next free key. Buttons with no remaining space will be skipped.`;
  if (!confirmed && !window.confirm(warning)) return;
  mergeDeviceLayoutButton.disabled = true;
  deployStatus.textContent = `Finding empty positions on ${surface.name} and merging the offline template…`;
  deployStatus.style.color = '';
  try {
    const response = await fetch('/api/deploy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plans, address: addressInput.value.trim(), surfaceId: surface.id, mergeAll: true }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    await refreshExistingButtons(viewedPage(), true);
    deployStatus.textContent = `Merged ${data.count} button${data.count === 1 ? '' : 's'} into ${surface.name}; ${data.relocated} moved to alternate empty position${data.relocated === 1 ? '' : 's'} and ${data.skipped} skipped for lack of space. Existing Companion buttons were preserved.`;
    deployStatus.style.color = 'var(--lime)';
    renderSurface();
  } catch (problem) {
    deployStatus.textContent = `Layout merge failed: ${problem.message}`;
    deployStatus.style.color = 'var(--red)';
  } finally { updateDeployState(); }
}

async function overwriteDeviceLayout(plansOverride = null, transferReport = null, confirmed = false) {
  const surface = selectedSurface();
  const defaultTransfer = surface?.id ? compatibleOfflineTransfer(surface) : null;
  const plans = Array.isArray(plansOverride) ? plansOverride : defaultTransfer?.accepted || [];
  transferReport ||= defaultTransfer;
  if (!surface?.id || surface.offline || (!plans.length && !transferReport?.desiredPageCount)) return;
  const pages = [...new Set(plans.map((plan) => plan.button.location.page))].sort((a, b) => a - b);
  const desiredPageCount = Math.max(1, Number(transferReport?.desiredPageCount) || pages.at(-1) || 1);
  const warning = `OVERWRITE ${surface.name}?\n\nThis will make Companion match the offline template’s ${desiredPageCount} layer${desiredPageCount === 1 ? '' : 's'}, permanently clear this device’s controls, then install ${plans.length} compatible offline Builder button${plans.length === 1 ? '' : 's'}.${transferReport?.skipped?.length ? ` ${transferReport.skipped.length} out-of-range button${transferReport.skipped.length === 1 ? '' : 's'} will be skipped.` : ''}\n\nExtra Companion layers will be removed and missing layers will be created. Other independently mapped Stream Decks will not be cleared. This cannot be undone in Builder.`;
  if (!confirmed && !window.confirm(warning)) return;
  overwriteDeviceLayoutButton.disabled = true;
  deployStatus.textContent = `Clearing ${surface.name} and pushing the complete offline layout…`;
  deployStatus.style.color = '';
  try {
    const response = await fetch('/api/deploy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plans, address: addressInput.value.trim(), surfaceId: surface.id, overwriteAll: true, desiredPageCount }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    // Companion can acknowledge the controls before its page registry and
    // rendered-button endpoint expose them. Keep the successfully transferred
    // buttons visible immediately, then reconcile against Companion's exact
    // render in the background just like a normal multi-button deployment.
    const previewPage = viewedPage();
    layoutSourceActivated = true;
    existingButtons = [];
    existingButtonsPage = previewPage;
    retainDeployedButtons(plans, previewPage);
    renderSurface();
    await refreshExistingButtons(previewPage, true);
    retainDeployedButtons(plans, previewPage);
    deployStatus.textContent = `Overwrote ${surface.name}: cleared ${data.cleared} existing control${data.cleared === 1 ? '' : 's'} across ${data.pagesCleared} page${data.pagesCleared === 1 ? '' : 's'} and pushed ${data.count} Builder button${data.count === 1 ? '' : 's'}.${transferReport?.skipped?.length ? ` ${transferReport.skipped.length} incompatible button${transferReport.skipped.length === 1 ? ' was' : 's were'} skipped.` : ''}`;
    deployStatus.style.color = 'var(--lime)';
    renderSurface();
    reconcileDeployedButtons(plans, surface.id, previewPage);
  } catch (problem) {
    deployStatus.textContent = `Layout overwrite failed: ${problem.message}`;
    deployStatus.style.color = 'var(--red)';
  } finally { updateDeployState(); }
}

function installConnectedSurfaces(surfaces) {
  const previouslyHadOnlineSurface = connectedSurfaces.some((surface) => surface.connected !== false);
  connectedSurfaces = surfaces;
  const online = surfaces.filter((surface) => surface.connected !== false);
  const selectedDuringSwitch = deviceSwitchInProgress ? deviceSwitchTargetId : '';
  const startupPolicy = companionStartupPolicy(online, { previouslyHadOnlineSurface, selectedDuringSwitch: Boolean(selectedDuringSwitch) });
  const { satelliteStartupOffline } = startupPolicy;
  const previous = selectedDuringSwitch || activeDeviceLayer()?.deviceId || deviceSelect.value || localStorage.getItem('connected-surface-id') || '';
  deviceSelect.replaceChildren(new Option(online.length ? 'Choose an online device' : 'No device online · use template', ''));
  for (const surface of online) {
    const option = document.createElement('option');
    option.value = surface.id;
    option.textContent = `${surface.name} · ${surface.columns}×${surface.rows}${surface.satellite ? ' · Satellite' : ''}`;
    deviceSelect.append(option);
  }
  const target = !workspaceSurfaceIds.size ? null : satelliteStartupOffline ? null : selectedDuringSwitch
    ? online.find((surface) => surface.id === selectedDuringSwitch) || null
    : offlineWorkspaceExplicitlyActivated ? null : online.find((surface) => surface.id === previous) || online[0] || null;
  deviceSelect.value = target?.id || '';
  if (target) {
    useOfflineTemplate = false;
    localStorage.setItem('use-offline-template', 'false');
    // A physical deck is the startup/reconnect default. Remove the fallback
    // offline surface and enroll every attached deck only on the transition
    // from no hardware to hardware. An offline surface explicitly added later
    // and a physical surface manually hidden during this session stay respected.
    if (!previouslyHadOnlineSurface && startupPolicy.enrollOnlineSurfacesAutomatically) {
      workspaceSurfaceIds = new Set([...workspaceSurfaceIds].filter((id) => !String(id).startsWith('offline:')));
      for (const surface of online) workspaceSurfaceIds.add(surface.id);
      if (online.length > 1) {
        workspaceViewEnabled = true;
        localStorage.setItem('ccb-workspace-view', 'true');
      }
      // Startup and reconnect are read-only device hydration paths. Display
      // the active deck's existing controls as well as the passive caches;
      // explicit CCB-to-device changes still require their normal confirmation.
      layoutSourceActivated = true;
    }
  } else if (!online.length || satelliteStartupOffline) {
    useOfflineTemplate = true;
    localStorage.setItem('use-offline-template', 'true');
    if (satelliteStartupOffline) {
      offlineWorkspaceExplicitlyActivated = true;
      workspaceSurfaceIds = new Set([modelSelect.value]);
      layoutSourceActivated = false;
    }
  }
  if (target) workspaceSurfaceIds.add(target.id);
  persistWorkspaceSelection();
  updateOfflineTemplateState();
  updateNetworkOverview();
  if (target) localStorage.setItem('connected-surface-id', target.id);
  renderWorkspacePicker();
}

async function refreshExistingButtons(page = 1, force = false) {
  const surface = selectedSurface();
  if (!companionOnline || !deviceSelect.value || !surface || surface.offline || surface.connected === false) {
    existingButtons = [];
    existingButtonsPage = page;
    lastButtonsRefresh = 0;
    return;
  }
  if (!force && page === existingButtonsPage && Date.now() - lastButtonsRefresh < 10000) return;
  try {
    const response = await fetch(`/api/companion-buttons?address=${encodeURIComponent(addressInput.value.trim())}&page=${page}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    existingButtons = (data.buttons || [])
      .filter((button) => !surface || surface.offline || (
        button.row >= surface.yOffset && button.row < surface.yOffset + surface.rows
        && button.column >= surface.xOffset && button.column < surface.xOffset + surface.columns
      ))
      .map((button) => button);
    workspaceButtonCache.set(workspaceCacheKey(surface.id, page), structuredClone(existingButtons));
    existingButtonsPage = page;
    lastButtonsRefresh = Date.now();
  } catch { existingButtons = []; workspaceButtonCache.set(workspaceCacheKey(surface.id, page), []); }
}

function optimisticButtonFromPlan(plan) {
  const appearance = plan.button.appearance?.states?.unmuted || plan.button.appearance || {};
  return {
    row: plan.button.location.row,
    column: plan.button.location.column,
    text: plan.button.text || 'BUTTON',
    textColor: appearance.textColor || '#ffffff',
    backgroundColor: appearance.backgroundColor || '#202630',
    image: null,
    actions: (plan.actions || []).map((action) => `Step ${action.step} · ${action.summary}`),
    programmedActions: [],
    optimistic: true,
  };
}

function retainDeployedButtons(plans, page) {
  if (existingButtonsPage !== page) { existingButtons = []; existingButtonsPage = page; }
  for (const plan of plans.filter((item) => item.button.location.page === page)) {
    const location = plan.button.location;
    if (!existingButtons.some((button) => button.row === location.row && button.column === location.column)) existingButtons.push(optimisticButtonFromPlan(plan));
  }
}

function retainWorkspaceDeployedButtons(plans, surface, page) {
  const key = workspaceCacheKey(surface.id, page);
  const buttons = structuredClone(workspaceButtonCache.get(key) || []);
  for (const plan of plans.filter((item) => item.button.location.page === page)) {
    const location = plan.button.location;
    if (!buttons.some((button) => button.row === location.row && button.column === location.column)) buttons.push(optimisticButtonFromPlan(plan));
  }
  workspaceButtonCache.set(key, buttons);
}

async function reconcileDeployedButtons(plans, surfaceId, page) {
  for (const delay of [250, 700, 1500]) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (selectedSurface()?.id !== surfaceId || viewedPage() !== page) return;
    await refreshExistingButtons(page, true);
    const complete = plans.filter((plan) => plan.button.location.page === page).every((plan) => existingButtons.some((button) => button.row === plan.button.location.row && button.column === plan.button.location.column));
    if (complete) { renderSurface(); return; }
    retainDeployedButtons(plans, page);
    renderSurface();
  }
}

async function pressConnectedPreviewButton(item) {
  const surface = selectedSurface();
  if (!companionOnline || !surface?.id || surface.offline || surface.connected === false) return;
  deployStatus.textContent = `Pressing ${item.page}/${item.row}/${item.column} on ${surface.name}…`;
  deployStatus.style.color = 'var(--cyan)';
  try {
    const response = await fetch('/api/companion-button/press', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), surfaceId: surface.id, pageNumber: item.page, row: item.row, column: item.column }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    deployStatus.textContent = `Pressed ${item.page}/${item.row}/${item.column} on ${surface.name}.`;
    deployStatus.style.color = 'var(--lime)';
    for (const delay of [80, 250, 600]) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (selectedSurface()?.id !== surface.id || viewedPage() !== item.page) return;
      await refreshExistingButtons(item.page, true);
      renderSurface();
      await refreshLiveButtonGraphics();
    }
  } catch (problem) {
    deployStatus.textContent = `Preview press failed: ${problem.message}`;
    deployStatus.style.color = 'var(--red)';
  }
}

async function refreshLiveButtonGraphics() {
  const surface = selectedSurface();
  if (buttonGraphicsRefreshRunning || document.hidden || !companionOnline || !surface?.id || surface.offline || surface.connected === false || !existingButtons.length) return;
  buttonGraphicsRefreshRunning = true;
  try {
    const page = viewedPage();
    const response = await fetch(`/api/companion-button-graphics?address=${encodeURIComponent(addressInput.value.trim())}&surfaceId=${encodeURIComponent(surface.id)}&page=${page}`);
    const data = await response.json();
    if (!response.ok || page !== viewedPage() || surface.id !== selectedSurface()?.id) return;
    const byLocation = new Map((data.graphics || []).map((graphic) => [`${graphic.row + surface.yOffset - 1}/${graphic.column + surface.xOffset - 1}`, graphic.image]));
    let changed = false;
    for (const button of existingButtons) {
      const image = byLocation.get(`${button.row}/${button.column}`);
      if (image && image !== button.image) { button.image = image; changed = true; }
    }
    if (changed) renderSurface();
  } catch {}
  finally { buttonGraphicsRefreshRunning = false; }
}

function renderSurface() {
  const model = selectedSurface();
  const grid = document.querySelector('#surface-grid');
  if (!model) {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = '1fr';
    grid.classList.remove('has-touch-strip', 'has-encoders');
    document.querySelector('#surface-warning').classList.add('hidden');
    document.querySelector('#surface-name').textContent = 'No surface selected';
    document.querySelector('#surface-size').textContent = 'Choose one or more workspace surfaces';
    selectedGridItem = null;
    deleteSelectedButton.disabled = true;
    cutSelectedButton.disabled = true;
    copySelectedButton.disabled = true;
    pasteButton.disabled = true;
    renderSelectedButtonSummary();
    renderWorkspaceSurfaces();
    updateDeployState();
    return;
  }
  const displayedPlans = surfacePlans();
  const visualKind = surfaceVisualKind(model);
  grid.classList.toggle('has-touch-strip', visualKind === 'streamdeck-plus');
  grid.classList.toggle('has-encoders', visualKind !== 'buttons');
  grid.style.gridTemplateColumns = `repeat(${model.columns}, minmax(0, 1fr))`;
  grid.innerHTML = '';
  const warning = document.querySelector('#surface-warning');
  warning.classList.add('hidden');
  document.querySelector('#surface-size').textContent = model.offline
    ? `${model.columns} columns × ${model.rows} rows`
    : `${model.columns} columns × ${model.rows} rows · Companion rows ${model.yOffset}–${model.yOffset + model.rows - 1}, columns ${model.xOffset}–${model.xOffset + model.columns - 1}`;
  const page = viewedPage();
  if (selectedGridItem && selectedGridItem.page !== page) selectedGridItem = null;
  deleteSelectedButton.disabled = !selectedGridItem || selectedGridItem.type === 'empty';
  deleteSelectedButton.textContent = selectedGridItem ? `Delete ${selectedGridItem.page}/${selectedGridItem.row}/${selectedGridItem.column}` : 'Delete Selected';
  const selectedHasButton = Boolean(selectedGridItem && selectedGridItem.type !== 'empty');
  cutSelectedButton.disabled = !selectedHasButton;
  copySelectedButton.disabled = !selectedHasButton;
  pasteButton.disabled = !(buttonClipboard && selectedGridItem?.type === 'empty');
  renderSelectedButtonSummary();
  document.querySelector('#surface-name').textContent = `${model.name}${model.offline ? ' · Offline template' : ' · Connected'} · Page ${page}`;
  updateTestButtonsMode();

  for (let row = 1; row <= model.rows; row += 1) {
    for (let column = 1; column <= model.columns; column += 1) {
      const key = document.createElement('div');
      key.className = 'surface-key';
      key.setAttribute('role', 'gridcell');
      // Connected surfaces use Companion's native shared-grid IDs verbatim,
      // including row or column zero.
      const actualRow = model.offline ? row - 1 : row + model.yOffset - 1;
      const actualColumn = model.offline ? column - 1 : column + model.xOffset - 1;
      key.dataset.row = String(actualRow);
      key.dataset.column = String(actualColumn);
      key.dataset.ccbLocation = `${page}/${actualRow}/${actualColumn}`;
      key.setAttribute('aria-label', key.dataset.ccbLocation);
      const encoderRow = surfaceHasRotaryControls(model) && ((visualKind === 'streamdeck-studio' && row === 1 && (column === 1 || column === model.columns)) || (visualKind === 'streamdeck-plus' && row === model.rows));
      const touchStripRow = visualKind === 'streamdeck-plus' && row === model.rows - 1;
      if (encoderRow) { key.classList.add('physical-encoder'); key.title = 'Physical encoder · rotary left/right + push'; }
      if (touchStripRow) {
        key.classList.add('touch-strip-segment');
        if (column === 1) key.classList.add('touch-strip-first');
        if (column === model.columns) key.classList.add('touch-strip-last');
        key.title = 'Touch strip segment · tap, vertical rotate gesture, and horizontal page swipe';
      }
      // The coordinate band below is the single grid-ID source. Empty cells
      // must not repeat the same location in their center.
      key.textContent = '';
      const existing = existingButtonsPage === page
        ? existingButtons.find((button) => button.row === actualRow && button.column === actualColumn)
        : null;
      const planned = displayedPlans.find((plan) => plan.button.location.page === page && plan.button.location.row === actualRow && plan.button.location.column === actualColumn);
      const pendingEdit = ['edit-button', 'replace-button'].includes(planned?.kind);
      const movingSource = currentPlan?.kind === 'move-button' && currentPlan.move.sourceLayerId === activeDeviceLayerId && currentPlan.move.from.page === page && currentPlan.move.from.row === actualRow && currentPlan.move.from.column === actualColumn;
      if (existing) {
        key.classList.add('existing');
        if (movingSource) {
          key.classList.add('moving-source');
          key.textContent = 'MOVING…';
        } else if (existing.image) {
          installGridGraphic(key, existing.image, existing.text || `Existing button ${actualRow}/${actualColumn}`, { exactLocation: true, controlId: existing.controlId || '' });
        } else key.textContent = existing.text || 'BUTTON';
        key.title = `Existing Companion button · click to select · double-click to press · row ${actualRow}, column ${actualColumn}`;
        key.style.background = existing.backgroundColor;
        key.style.color = existing.textColor;
        const item = { type: 'existing', page, row: actualRow, column: actualColumn, existing: structuredClone(existing) };
        key.dataset.selectionKey = gridItemKey(item.type, page, actualRow, actualColumn);
        key.addEventListener('click', () => testButtonsMode ? pressConnectedPreviewButton(item) : selectGridItem(item));
        key.addEventListener('dblclick', (event) => { event.preventDefault(); pressConnectedPreviewButton(item); });
        if (!planned && !movingSource && !testButtonsMode) {
          key.draggable = true;
          key.classList.add('movable-existing');
          key.title += ' · drag to an empty key to move';
          key.addEventListener('dragstart', (event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', `existing:${existing.row}:${existing.column}`);
            activeDragPayload = { type: 'existing', sourceLayerId: activeDeviceLayerId, sourcePage: page, existing: structuredClone(existing) };
            buttonClipboard = { type: 'companion', mode: 'cut', label: existing.text || 'Companion button', sourceSurfaceId: model.id, source: { page, row: actualRow, column: actualColumn } };
            event.dataTransfer.setDragImage(key, key.clientWidth / 2, key.clientHeight / 2);
            key.classList.add('dragging');
          });
          key.addEventListener('dragend', (event) => finishOrCarryDrag(event, key));
        }
      }
      if (planned && !pendingEdit) {
        key.classList.add('active');
        if (planned !== currentPlan) key.classList.add('batch-planned');
        if (planned.kind === 'move-button' && planned.button.image) {
          installGridGraphic(key, planned.button.image, planned.button.text || 'Button being moved', { controlId: planned.button.controlId || '' });
        } else {
          const parts = planned.button.text.split('\n');
          key.innerHTML = `<span>${parts[0]}</span>${parts[1] ? `<strong>${parts.slice(1).join(' ')}</strong>` : ''}`;
          const simulatedState = offlineGridToggleStates.get(gridLocationKey(page, actualRow, actualColumn)) || 'unmuted';
          const activeAppearance = model.offline && testButtonsMode && planned.button.appearance.states
            ? planned.button.appearance.states[simulatedState]
            : planned === currentPlan ? previewAppearance() : (planned.button.appearance.states?.unmuted || planned.button.appearance);
          key.style.background = activeAppearance.backgroundColor;
          key.style.color = activeAppearance.textColor;
        }
        key.draggable = !testButtonsMode && planned.kind !== 'edit-button';
        key.dataset.planIndex = String(displayedPlans.indexOf(planned));
        key.title = `${key.title ? `${key.title} · ` : ''}Drag to move this planned button`;
        key.addEventListener('dragstart', (event) => {
          if (planned.kind === 'edit-button') { event.preventDefault(); return; }
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', key.dataset.planIndex);
          activeDragPayload = { type: 'planned', sourceLayerId: activeDeviceLayerId, planIndex: Number(key.dataset.planIndex), plan: structuredClone(planned) };
          buttonClipboard = { type: 'planned', mode: 'cut', label: planned.button.text.replace(/\n/g, ' '), plan: structuredClone(planned), sourceLayerId: activeDeviceLayerId, sourcePlanKey: devicePlanKey(activeDeviceLayer()?.deviceId || '', page), source: { page, row: actualRow, column: actualColumn } };
          event.dataTransfer.setDragImage(key, key.clientWidth / 2, key.clientHeight / 2);
          key.classList.add('dragging');
        });
        key.addEventListener('dragend', (event) => finishOrCarryDrag(event, key));
        const item = { type: 'planned', page, row: actualRow, column: actualColumn, planIndex: displayedPlans.indexOf(planned) };
        key.dataset.selectionKey = gridItemKey(item.type, page, actualRow, actualColumn);
        key.addEventListener('click', () => {
          if (testButtonsMode && model.offline) toggleOfflineGridButton(planned);
          else if (testButtonsMode && existing) pressConnectedPreviewButton({ type: 'existing', page, row: actualRow, column: actualColumn, existing });
          else if (crossLayerDragArmed && activeDragPayload) dropActiveButton(actualRow, actualColumn);
          else selectGridItem(item);
        });
      }
      if (!existing && !planned) {
        const item = { type: 'empty', page, row: actualRow, column: actualColumn };
        key.dataset.selectionKey = gridItemKey(item.type, page, actualRow, actualColumn);
        if (buttonClipboard) key.title = 'Empty position · select as paste destination';
        if (crossLayerDragArmed && activeDragPayload) {
          key.classList.add('carry-target');
          key.title = 'Place carried button here';
        }
        key.addEventListener('click', () => {
          if (crossLayerDragArmed && activeDragPayload) dropActiveButton(actualRow, actualColumn);
          else selectGridItem(item);
        });
      }
      const selectionKey = key.dataset.selectionKey;
      if (selectionKey && selectedGridItem && selectionKey === gridItemKey(selectedGridItem.type, selectedGridItem.page, selectedGridItem.row, selectedGridItem.column)) key.classList.add('selected');
      const coordinateLabel = document.createElement('small');
      coordinateLabel.className = 'surface-key-coordinate';
      coordinateLabel.textContent = `${page}/${actualRow}/${actualColumn}`;
      key.addEventListener('dragover', (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; key.classList.add('drop-target'); });
      key.addEventListener('dragleave', () => key.classList.remove('drop-target'));
      key.addEventListener('drop', (event) => {
        event.preventDefault();
        key.classList.remove('drop-target');
        if (activeDragPayload?.workspace) dropWorkspaceButton(model, { page, row: actualRow, column: actualColumn });
        else dropActiveButton(actualRow, actualColumn);
      });
      const cell = document.createElement('div');
      cell.className = 'surface-cell';
      cell.append(coordinateLabel, key);
      grid.append(cell);
    }
  }

  if (currentPlan && !compatibility().compatible) {
    warning.textContent = `At least one batch location is outside ${model.name}'s usable grid. The offline plan is preserved, but the batch cannot be pushed to this device.`;
    warning.classList.remove('hidden');
  } else if (!model.offline && model.connected === false) {
    warning.textContent = `${model.name} is configured in Companion but has no USB connection. Reconnect it to push Builder changes.`;
    warning.classList.remove('hidden');
  } else if (currentPlan && model.offline && companionOnline) {
    warning.textContent = 'This is an offline template. Select a connected device to push; compatible button coordinates will be preserved exactly.';
    warning.classList.remove('hidden');
  }
  renderWorkspaceSurfaces();
  updateDeployState();
}

async function deleteSelectedGridItem() {
  const item = selectedGridItem;
  if (!item) return;
  if (item.type === 'planned') {
    const index = currentPlans.findIndex((plan) => plan.button.location.page === item.page && plan.button.location.row === item.row && plan.button.location.column === item.column);
    if (index >= 0) currentPlans.splice(index, 1);
    currentPlan = currentPlans[0] || null;
    selectedGridItem = null;
    saveActiveDeviceLayer();
    deployStatus.textContent = `Removed unpushed Builder button at ${item.page}/${item.row}/${item.column}.`;
    renderSurface();
    return;
  }
  const surface = selectedSurface();
  if (!companionOnline || !surface || surface.offline) return;
  if (!window.confirm(`Delete the Companion button at ${item.page}/${item.row}/${item.column}? This cannot be undone in Builder.`)) return;
  deleteSelectedButton.disabled = true;
  deployStatus.textContent = `Deleting ${item.page}/${item.row}/${item.column} from Companion…`;
  try {
    const response = await fetch('/api/companion-button', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addressInput.value.trim(), surfaceId: surface.id, pageNumber: item.page, row: item.row, column: item.column }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    selectedGridItem = null;
    existingButtons = existingButtons.filter((button) => button.row !== item.row || button.column !== item.column);
    lastButtonsRefresh = 0;
    await refreshExistingButtons(item.page, true);
    deployStatus.textContent = `Deleted Companion button at ${item.page}/${item.row}/${item.column}.`;
  } catch (deleteError) { deployStatus.textContent = deleteError.message; deployStatus.style.color = 'var(--red)'; }
  renderSurface();
}

function enterCompanionOfflineState(wasDeviceSelected) {
  companionOnline = false;
  connectedSurfaces = [];
  activeConnections = [];
  activeButtonGraphics = {};
  connectionNetworkCache.clear();
  existingButtons = [];
  existingButtonsPage = viewedPage();
  selectedGridItem = null;
  lastButtonsRefresh = 0;
  buttonGraphicsRefreshRunning = false;
  if (wasDeviceSelected) {
    currentPlan = null;
    currentPlans = [];
    previewBasePlans = [];
    pendingButtonPreview = false;
    layoutSourceActivated = false;
    // Keep offline workspace caches and the checked physical-surface IDs. Live
    // surfaces disappear while disconnected and rehydrate when rediscovered.
    deviceLayers = [{ id: 'layout-1', name: 'Deck layout 1', page: 1, model: modelSelect.value, deviceId: '', plans: [] }];
    activeDeviceLayerId = 'layout-1';
    pageInput.value = '1';
    clearButtonPreview();
    renderDeviceLayerOptions(activeDeviceLayerId);
  }
  useOfflineTemplate = true;
  deviceSelect.replaceChildren(new Option('Companion offline · no devices', ''));
  deviceSelect.value = '';
  buttonGraphicSelect.replaceChildren(new Option('Companion offline · images unavailable', ''));
  buttonGraphicSelect.disabled = true;
  buttonGraphicNote.textContent = 'Reconnect Companion to restore module images';
  targetModuleSelect.replaceChildren(new Option('Companion offline · modules unavailable', ''));
  targetModuleSelect.disabled = true;
  clearTargetModuleButton.disabled = true;
  targetModuleNote.textContent = 'Reconnect Companion to restore module targeting';
  const registry = document.querySelector('#connection-registry-list');
  registry.replaceChildren(Object.assign(document.createElement('span'), { textContent: 'Companion offline · connection and module status unavailable.' }));
  document.querySelector('#connection-registry-summary').textContent = 'OFFLINE · no Companion module inventory';
  deployButton.disabled = true;
  addDeviceLayerButton.disabled = true;
  removeDeviceLayerButton.disabled = true;
  status.className = 'network-status offline';
  status.querySelector('span').textContent = 'Companion offline · devices, buttons, and modules unavailable';
  updateOfflineTemplateState();
  updateNetworkOverview();
  renderSurface();
}

async function checkConnection(quiet = false) {
  if (deviceSwitchInProgress && quiet) return;
  if (connectionCheckRunning) return;
  connectionCheckRunning = true;
  const address = addressInput.value.trim();
  localStorage.setItem('companion-address', address);
  if (!quiet) { status.className = 'network-status checking'; status.querySelector('span').textContent = 'Checking…'; }
  try {
    const response = await fetch(`/api/companion-status?address=${encodeURIComponent(address)}`);
    const data = await response.json();
    if (!data.online) throw new Error(data.error || 'Unavailable');
    companionOnline = true;
    if (targetModuleSelect.disabled) { targetModuleSelect.disabled = false; await refreshInstalledModules(); }
    await refreshButtonGraphics(address);
    const surfacesResponse = await fetch(`/api/companion-surfaces?address=${encodeURIComponent(address)}`);
    const surfacesData = await surfacesResponse.json();
    if (!surfacesResponse.ok) throw new Error(surfacesData.error);
    let discoveredSurfaces = surfacesData.surfaces || [];
    if (surfacesData.overlapping && discoveredSurfaces.filter((surface) => surface.connected !== false).length > 1) {
      const arrangementResponse = await fetch('/api/companion-surfaces/arrange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
      const arrangement = await arrangementResponse.json();
      if (!arrangementResponse.ok) throw new Error(arrangement.error || 'Automatic surface placement failed.');
      discoveredSurfaces = arrangement.surfaces || discoveredSurfaces;
    }
    installConnectedSurfaces(discoveredSurfaces);
    const pagesResponse = await fetch(`/api/companion-pages?address=${encodeURIComponent(address)}`);
    const pagesData = await pagesResponse.json();
    if (!pagesResponse.ok) throw new Error(pagesData.error);
    if (deviceSelect.value && (!deviceSwitchInProgress || !quiet)) installCompanionLayers(pagesData.pages || []);
    if (layoutSourceActivated) await refreshExistingButtons(viewedPage(), !quiet);
    else { existingButtons = []; existingButtonsPage = viewedPage(); }
    await refreshWorkspaceButtonCaches(viewedPage());
    const attached = discoveredSurfaces.filter((surface) => surface.connected !== false);
    const disconnected = discoveredSurfaces.filter((surface) => surface.connected === false);
    status.className = disconnected.length && !attached.length ? 'network-status offline' : 'network-status online';
    status.querySelector('span').textContent = attached.length
      ? `Connected · Companion ${data.version || ''} · ${attached.length} deck${attached.length === 1 ? '' : 's'}`.trim()
      : disconnected.length
        ? `Companion ${data.version || ''} connected · ${disconnected.map((surface) => surface.name).join(', ')} disconnected`
      : `Connected · Companion ${data.version || ''} · no Stream Deck detected`.trim();
    renderSurface();
    if (companionStartupPolicy(attached).autoPromptStartupSync) promptStartupSurfaceSync(attached);
  } catch {
    enterCompanionOfflineState(Boolean(deviceSelect.value));
  } finally { connectionCheckRunning = false; }
}

async function preview() {
  validation.textContent = 'Parsing…'; validation.style.color = '';
  try {
    const surface = selectedSurface();
    const page = Math.max(1, Number(activeDeviceLayer()?.page || pageInput.value) || 1);
    const occupied = [
      ...surfacePlans(),
      ...(surface?.offline ? [] : existingButtons.map((button) => ({ page: existingButtonsPage, row: button.row, column: button.column }))),
    ];
    const defaultLocation = firstOpenSurfaceLocation(surface, page, occupied);
    const response = await fetch('/api/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ command: command.value, defaultLocation, address: addressInput.value.trim(), surface: modelSelect.value, surfaceId: surface?.id || null, aiEnabled: aiEnabled.checked, moduleId: targetModuleSelect.value || '', enabledModuleIds: knownModuleIds.filter(moduleIsEnabled) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (!pendingButtonPreview) previewBasePlans = structuredClone(currentPlans);
    currentPlans = data.batch ? data.plans : [data];
    pendingButtonPreview = true;
    setSessionDirty(true);
    const graphic = activeButtonGraphics[buttonGraphicSelect.value];
    if (graphic) for (const item of currentPlans) {
      item.button.graphic = { id: buttonGraphicSelect.value, symbol: graphic.symbol, label: graphic.label };
      item.button.text = `${graphic.symbol}\n${item.button.text}`;
    }
    for (const item of currentPlans) {
      const requestedSize = item.button.appearance?.textSize ?? 'auto';
      item.button.appearance.requestedTextSize = requestedSize;
      item.button.appearance.textSize = companionSafeFontPercent(item.button.text, requestedSize);
      if (item.button.appearance.states?.unmuted) item.button.appearance.states.unmuted.textSize = item.button.appearance.textSize;
      if (item.button.appearance.states?.muted) item.button.appearance.states.muted.textSize = item.button.appearance.textSize;
    }
    currentPlan = currentPlans[0];
    const plan = currentPlan;
    pageInput.value = String(plan.button.location.page);
    previewToggleState = 'unmuted';
    await refreshExistingButtons(plan.button.location.page, true);
    const location = plan.button.location;
    const previewKey = document.querySelector('#deck-button');
    previewKey.dataset.ccbLocation = `${location.page}/${location.row}/${location.column}`;
    previewKey.classList.remove('exact-render', 'quick-simulated');
    previewKey.style.boxShadow = '';
    document.querySelector('#button-channel').style.cssText = '';
    document.querySelector('#button-action').style.cssText = '';
    document.querySelector('#button-render').classList.add('hidden');
    updateDeployState();
    const action = plan.button.action;
    const textLayout = previewTextLayout(plan.button.text, plan.button.appearance.textSize ?? 'auto');
    document.querySelector('#button-channel').textContent = textLayout.lines.join('\n');
    document.querySelector('#button-channel').style.fontSize = `${textLayout.size}px`;
    document.querySelector('#button-channel').style.lineHeight = '.98';
    document.querySelector('#button-action').textContent = '';
    document.querySelector('#button-location').textContent = `Page ${location.page} · Row ${location.row} · Column ${location.column}`;
    const targets = action.family === 'aux-mute' ? action.auxes : action.family === 'control-group-mute' ? action.controlGroups : action.channels || [];
    const targetName = action.family === 'aux-mute' ? 'AUX' : action.family === 'control-group-mute' ? 'CG' : 'CH';
    const channelText = targets.length === 1 ? `${targetName} ${targets[0]}` : `${targetName} ${targets.join(', ')}`;
    const behavior = plan.button.behavior || (plan.kind === 'edit-button'
      ? plan.edit.descriptions.join(' · ')
      : action.family === 'macro'
      ? `Fire macro ${action.macro}`
      : action.family === 'snapshot'
      ? action.operation === 'next-snapshot' ? 'Fire next snapshot' : action.operation === 'previous-snapshot' ? 'Fire previous snapshot' : `Fire snapshot ${action.snapshot}`
      : action.family === 'channel-fader'
      ? `Set fader ${action.levelDb === 'OFF' ? 'OFF' : `${action.levelDb > 0 ? '+' : ''}${action.levelDb} dB`} · ${channelText}`
      : action.family === 'variable-display'
      ? `Display Shure channel ${action.channel} ${action.operation === 'show-frequency' ? 'frequency' : 'audio gain'}`
      : `${action.operation === 'mute' ? 'Set mute ON' : action.operation === 'unmute' ? 'Set mute OFF' : 'Toggle mute state'} · ${channelText}`);
    document.querySelector('#behavior').textContent = behavior;
    const stateColors = plan.button.appearance.states;
    const stateColorsLabel = document.querySelector('#state-colors-label');
    const stateColorsText = document.querySelector('#state-colors');
    if (stateColors) {
      stateColorsText.textContent = `Preview: UNMUTED · click button to toggle · Unmuted: ${stateColors.unmuted.textColor} on ${stateColors.unmuted.backgroundColor} · Muted: ${stateColors.muted.textColor} on ${stateColors.muted.backgroundColor}`;
      stateColorsLabel.classList.remove('hidden'); stateColorsText.classList.remove('hidden');
    } else { stateColorsLabel.classList.add('hidden'); stateColorsText.classList.add('hidden'); }
    const manifest = document.querySelector('#action-manifest');
    manifest.replaceChildren(...plan.actions.map((item) => {
      const row = document.createElement('li');
      row.textContent = `Step ${item.step} · ${item.summary} · ${item.actionId}`;
      return row;
    }));
    renderBatchList();
    document.querySelector('#target-instance').textContent = addressInput.value.trim();
    applyPreviewAppearance();
    empty.classList.add('hidden'); error.classList.add('hidden'); result.classList.remove('hidden');
    const aiPlans = currentPlans.filter((item) => item.ai?.used);
    const isUpdate = ['edit-button', 'replace-button'].includes(plan.kind);
    const isCreate = plan.kind === 'create-button';
    setPushButton(isUpdate ? 'Push Button Update' : 'Push Layout from Builder', plan.kind === 'edit-button' ? 'Preserve actions and feedbacks' : plan.kind === 'replace-button' ? 'Replace reviewed button programming' : 'Send planned changes to Companion');
    updatePreviewButton.classList.toggle('hidden', !isUpdate);
    confirmAddButton.classList.toggle('hidden', !isCreate);
    const offlinePreview = Boolean(selectedSurface()?.offline);
    confirmAddButton.textContent = currentPlans.length > 1
      ? `Confirm Add ${currentPlans.length} Buttons to ${offlinePreview ? 'Builder Layer' : 'Companion'}`
      : `Confirm Add to ${offlinePreview ? 'Builder Layer' : 'Companion'}`;
    updatePreviewButton.disabled = !companionOnline || Boolean(selectedSurface()?.offline);
    validation.textContent = currentPlans.length > 1 ? `Valid batch · ${currentPlans.length} buttons${aiPlans.length ? ` · AI interpreted ${aiPlans.length}` : ''}` : plan.kind === 'edit-button' ? 'Existing button edit · actions preserved' : plan.kind === 'replace-button' ? 'Existing button behavior replacement · review before updating' : plan.ai?.used ? `AI interpreted · ${plan.ai.interpretation}` : 'Valid command'; validation.style.color = 'var(--lime)';
    renderSurface();
  } catch (problem) {
    currentPlan = null;
    if (pendingButtonPreview) currentPlans = previewBasePlans;
    previewBasePlans = [];
    pendingButtonPreview = false;
    empty.classList.add('hidden'); result.classList.add('hidden'); error.classList.remove('hidden');
    updatePreviewButton.classList.add('hidden');
    confirmAddButton.classList.add('hidden');
    deployButton.disabled = true;
    error.querySelector('span').textContent = problem.message; validation.textContent = 'Needs attention'; validation.style.color = 'var(--red)'; renderSurface();
  }
}

function togglePreviewState() {
  const states = currentPlan?.button?.appearance?.states;
  if (!states) return;
  previewToggleState = previewToggleState === 'unmuted' ? 'muted' : 'unmuted';
  applyPreviewAppearance();
  document.querySelector('#state-colors').textContent = `Preview: ${previewToggleState.toUpperCase()} · click button to toggle · Unmuted: ${states.unmuted.textColor} on ${states.unmuted.backgroundColor} · Muted: ${states.muted.textColor} on ${states.muted.backgroundColor}`;
  renderSurface();
}

async function dictate() {
  stopAudioMeter();
  dictateButton.disabled = true;
  dictateButton.classList.add('listening');
  dictateButton.querySelector('span').textContent = 'Listening…';
  dictateButton.querySelector('small').textContent = 'Listening · pause up to 4.5 seconds';
  try {
    await startAudioMeter();
    const response = await fetch('/api/dictate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceUid: audioInputSelect.value, channelIndex: audioInputChannelSelect.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    command.value = data.transcript;
    setSessionDirty(true);
    command.focus();
    validation.textContent = 'Voice command captured';
    validation.style.color = 'var(--cyan)';
  } catch (problem) {
    validation.textContent = problem.message;
    validation.style.color = 'var(--red)';
  } finally {
    stopAudioMeter();
    dictateButton.disabled = false;
    dictateButton.classList.remove('listening');
    dictateButton.querySelector('span').textContent = 'Dictate command';
    dictateButton.querySelector('small').textContent = 'Apple Speech';
  }
}

function stopAudioMeter() {
  if (!audioMeterSession) return;
  cancelAnimationFrame(audioMeterSession.frame);
  audioMeterSession.stream.getTracks().forEach((track) => track.stop());
  audioMeterSession.context.close().catch(() => {});
  audioMeterSession = null;
  audioMeterLevel.style.width = '0%';
  audioMeterLevel.parentElement.setAttribute('aria-valuenow', '0');
  audioMeterStatus.textContent = 'Mic off · press Dictate';
}

async function startAudioMeter() {
  if (!navigator.mediaDevices?.getUserMedia) { audioMeterStatus.textContent = 'Browser meter unavailable'; return; }
  audioMeterStatus.textContent = 'Opening input…';
  try {
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    permissionStream.getTracks().forEach((track) => track.stop());
    const selectedName = audioInputSelect.selectedOptions[0]?.textContent.replace(/ · macOS default$/, '') || '';
    const matchingDevice = audioInputSelect.value ? devices.find((device) => device.kind === 'audioinput' && (device.label === selectedName || device.label.includes(selectedName))) : null;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: matchingDevice ? { deviceId: { exact: matchingDevice.deviceId } } : true });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const channel = Number(audioInputChannelSelect.value || 0);
    const channels = Math.max(1, source.channelCount || 1);
    if (channels > 1) { const splitter = context.createChannelSplitter(channels); source.connect(splitter); splitter.connect(analyser, Math.min(channel, channels - 1)); }
    else source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    audioMeterSession = { stream, context, frame: 0 };
    const update = () => {
      if (!audioMeterSession) return;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0; for (const sample of samples) sum += sample * sample;
      const db = 20 * Math.log10(Math.max(0.00001, Math.sqrt(sum / samples.length)));
      const percent = Math.max(0, Math.min(100, (db + 60) * (100 / 60)));
      audioMeterLevel.style.width = `${percent}%`;
      audioMeterLevel.parentElement.setAttribute('aria-valuenow', String(Math.round(percent)));
      audioMeterStatus.textContent = percent < 3 ? 'No signal' : percent > 92 ? 'Clipping' : `${Math.round(db)} dBFS`;
      audioMeterSession.frame = requestAnimationFrame(update);
    };
    update();
  } catch (problem) { stopAudioMeter(); audioMeterStatus.textContent = problem.name === 'NotAllowedError' ? 'Mic permission denied' : 'Input unavailable'; }
}

async function refreshAudioInputs() {
  refreshAudioInputsButton.disabled = true;
  const selected = audioInputSelect.value || localStorage.getItem('audio-input-device') || '';
  try {
    const response = await fetch('/api/audio-inputs');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    audioInputSelect.replaceChildren(new Option('System Default Input', ''));
    for (const device of data.devices || []) { const option = new Option(`${device.name}${device.isDefault ? ' · macOS default' : ''}`, device.uid); option.dataset.channels = String(device.channels || 1); audioInputSelect.append(option); }
    audioInputSelect.value = [...audioInputSelect.options].some((option) => option.value === selected) ? selected : '';
    audioInputSelect.disabled = !data.packaged;
    if (!data.packaged) audioInputSelect.options[0].textContent = 'Available in packaged macOS app';
  } catch { audioInputSelect.replaceChildren(new Option('Audio inputs unavailable', '')); audioInputSelect.disabled = true; }
  finally { refreshAudioInputsButton.disabled = false; }
  refreshAudioChannels();
  stopAudioMeter();
}

function refreshAudioChannels() {
  const device = audioInputSelect.selectedOptions[0];
  const details = device ? Number(device.dataset.channels || 0) : 0;
  const saved = localStorage.getItem(`audio-input-channel:${audioInputSelect.value}`) || '';
  audioInputChannelSelect.replaceChildren(new Option('Automatic channels', ''));
  for (let channel = 0; channel < details; channel += 1) audioInputChannelSelect.append(new Option(`Input ${channel + 1}`, String(channel)));
  audioInputChannelSelect.value = [...audioInputChannelSelect.options].some((option) => option.value === saved) ? saved : (details > 1 ? '0' : '');
  audioInputChannelSelect.disabled = !audioInputSelect.value || details < 2;
}

async function deploy() {
  if (!currentPlans.length || !companionOnline) return;
  const deployedPlans = [...currentPlans];
  const deployedPlan = currentPlan;
  const deployedCreates = deployedPlans.every((plan) => plan.kind === 'create-button');
  const deployedUpdates = deployedPlans.every((plan) => ['edit-button', 'replace-button'].includes(plan.kind));
  deployButton.disabled = true;
  confirmAddButton.disabled = true;
  deployStatus.textContent = currentPlans.some((plan) => plan.kind === 'move-button') ? 'Moving existing Companion button…' : currentPlans.some((plan) => ['edit-button', 'replace-button'].includes(plan.kind)) ? `Pushing ${currentPlans.length} existing button update${currentPlans.length === 1 ? '' : 's'}…` : currentPlans.length > 1 ? `Pushing ${currentPlans.length} Builder buttons…` : 'Pushing Builder button…';
  deployStatus.style.color = '';
  try {
    const selectedAtDeploy = selectedSurface();
    const surface = compatibility().surface || selectedAtDeploy;
    const targetIsSelected = surface?.id === selectedAtDeploy?.id;
    const response = await fetch('/api/deploy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plans: currentPlans, address: addressInput.value.trim(), surfaceId: surface?.id }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    layoutSourceActivated = true;
    if (targetIsSelected) await refreshExistingButtons(deployedPlan.button.location.page, true);
    else await refreshWorkspaceButtonCaches(deployedPlan.button.location.page);
    if (data.moved) for (const page of moveRefreshPages(deployedPlan.move?.from?.page, deployedPlan.button.location.page).filter((page) => page !== deployedPlan.button.location.page)) await refreshWorkspaceButtonCaches(page);
    const exact = targetIsSelected ? existingButtons.find((button) => button.row === deployedPlan.button.location.row && button.column === deployedPlan.button.location.column) : null;
    // Keep the last verified source render visible while Companion completes
    // the destination render after a native move. The settled graphics poll
    // below will replace it with the destination's final feedback state.
    if (data.moved && exact && deployedPlan.button.image) exact.image = deployedPlan.button.image;
    if (exact?.image) {
      const rendered = document.querySelector('#button-render');
      rendered.src = exact.image;
      rendered.classList.remove('hidden');
      document.querySelector('#deck-button').classList.add('exact-render');
    }
    if (data.moved) {
      currentPlan = null;
      currentPlans = [];
      saveActiveDeviceLayer();
      setPushButton();
    }
    renderSurface();
    const localLocation = deployedPlan.button.location;
    deployStatus.textContent = data.batch
      ? `${data.updated ? 'Updated' : 'Pushed'} ${data.count} buttons in Companion successfully.`
      : data.moved ? `Moved to ${localLocation.page}/${localLocation.row}/${localLocation.column}; all original programming preserved.`
      : data.updated ? `Updated ${localLocation.page}/${localLocation.row}/${localLocation.column}; actions and feedbacks preserved.`
      : `Pushed to ${localLocation.page}/${localLocation.row}/${localLocation.column} using ${data.connection}.`;
    deployStatus.style.color = 'var(--lime)';
    if (deployedCreates) {
      clearButtonPreview();
      saveActiveDeviceLayer();
      validation.textContent = deployedPlans.length > 1 ? `${deployedPlans.length} buttons added to Companion` : 'Button added to Companion';
      validation.style.color = 'var(--lime)';
      if (targetIsSelected) {
        await refreshExistingButtons(deployedPlan.button.location.page, true);
        retainDeployedButtons(deployedPlans, deployedPlan.button.location.page);
      } else {
        retainWorkspaceDeployedButtons(deployedPlans, surface, deployedPlan.button.location.page);
        await refreshWorkspaceButtonCaches(deployedPlan.button.location.page);
        retainWorkspaceDeployedButtons(deployedPlans, surface, deployedPlan.button.location.page);
      }
      renderSurface();
      if (targetIsSelected) reconcileDeployedButtons(deployedPlans, surface.id, deployedPlan.button.location.page);
    }
    if (deployedUpdates) {
      currentPlan = null;
      currentPlans = [];
      saveActiveDeviceLayer();
      validation.textContent = deployedPlans.length > 1 ? `${deployedPlans.length} buttons updated in Companion` : 'Button updated in Companion';
      validation.style.color = 'var(--lime)';
      await refreshExistingButtons(deployedPlan.button.location.page, true);
      selectedGridItem = null;
      if (previewDispositionAfterDeploy(deployedPlans.map((plan) => plan.kind)) === 'clear') clearButtonPreview();
      renderSurface();
    }
  } catch (problem) {
    deployStatus.textContent = problem.message;
    deployStatus.style.color = 'var(--red)';
    const failedMove = deployedPlans.find((plan) => plan.kind === 'move-button');
    if (failedMove) {
      cancelMovePreview();
      for (const page of moveRefreshPages(failedMove.move?.from?.page, failedMove.button.location.page)) await refreshWorkspaceButtonCaches(page);
      await refreshExistingButtons(viewedPage(), true);
      renderSurface();
    }
    const warning = document.querySelector('#surface-warning');
    warning.textContent = `${deployedUpdates ? 'Update' : deployedPlans.some((plan) => plan.kind === 'move-button') ? 'Move' : 'Push'} failed: ${problem.message}`;
    warning.classList.remove('hidden');
  } finally { updateDeployState(); }
}

async function syncFromDevice(confirmed = false) {
  if (!confirmed && currentPlans.length && !window.confirm('Syncing from the device will discard unpushed changes on the selected Builder layer. Continue?')) return;
  syncFromDeviceButton.disabled = true;
  syncFromDeviceButton.querySelector('small').textContent = 'Reading Companion…';
  try {
    layoutSourceActivated = true;
    currentPlan = null; currentPlans = [];
    saveActiveDeviceLayer();
    await checkConnection(false);
    await refreshExistingButtons(activeDeviceLayer().page, true);
    result.classList.add('hidden'); error.classList.add('hidden'); empty.classList.remove('hidden');
    renderSurface();
    deployStatus.textContent = `Synced ${existingButtons.length} button${existingButtons.length === 1 ? '' : 's'} from ${selectedSurface()?.name || 'Companion'} · ${activeDeviceLayer().name}.`;
    deployStatus.style.color = 'var(--lime)';
    validation.textContent = 'Device layout synchronized'; validation.style.color = 'var(--lime)';
  } catch (problem) {
    deployStatus.textContent = problem.message; deployStatus.style.color = 'var(--red)';
  } finally {
    syncFromDeviceButton.disabled = false;
    syncFromDeviceButton.querySelector('small').textContent = 'Load Companion into Builder';
  }
}

async function runSurfaceQuickAction(action) {
  const surface = selectedSurface();
  const pageNumber = viewedPage();
  if (action === 'clear-page' && surface?.offline) {
    // Clear committed layout data, not a transient command preview. Otherwise
    // the pending-preview flag can continue masking a subsequently loaded file.
    currentPlans = structuredClone(surfacePlans());
    pendingButtonPreview = false;
    previewBasePlans = [];
    const count = currentPlans.filter((plan) => plan.button.location.page === pageNumber).length;
    if (!count || !window.confirm(`Clear all ${count} planned Builder button${count === 1 ? '' : 's'} from offline ${activeDeviceLayer().name}?`)) return;
    currentPlans = currentPlans.filter((plan) => plan.button.location.page !== pageNumber);
    currentPlan = currentPlans[0] || null;
    selectedGridItem = null;
    finishDragInteraction();
    saveActiveDeviceLayer();
    setSessionDirty(true);
    setPushButton();
    if (!currentPlans.length) { result.classList.add('hidden'); error.classList.add('hidden'); empty.classList.remove('hidden'); }
    deployStatus.textContent = `Cleared ${count} planned button${count === 1 ? '' : 's'} from offline ${activeDeviceLayer().name}.`;
    deployStatus.style.color = 'var(--lime)';
    renderSurface();
    return;
  }
  if (!surface?.id || surface.offline) return;
  if (action === 'clear-page' && !window.confirm(`Clear every Companion control for ${surface.name} on page ${pageNumber}? This cannot be undone.`)) return;
  const buttons = [clearDevicePageButton, addLayerScrollButton, initializeEncodersButton];
  buttons.forEach((button) => { button.disabled = true; });
  deployStatus.textContent = action === 'clear-page' ? 'Clearing selected device page…' : action === 'add-layer-scroll' ? 'Adding native previous/next layer controls…' : 'Initializing physical encoders…';
  deployStatus.style.color = '';
  try {
    const response = await fetch('/api/companion-quick-action', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, address: addressInput.value.trim(), surfaceId: surface.id, pageNumber }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (action === 'clear-page') {
      currentPlans = currentPlans.filter((plan) => plan.button.location.page !== pageNumber);
      currentPlan = currentPlans[0] || null;
      saveActiveDeviceLayer();
      deployStatus.textContent = `Cleared ${data.count} control${data.count === 1 ? '' : 's'} from ${surface.name} page ${pageNumber}.`;
    } else if (action === 'add-layer-scroll') {
      deployStatus.textContent = `Added previous at ${pageNumber}/${data.previous.row}/${data.previous.column} and next at ${pageNumber}/${data.next.row}/${data.next.column}.`;
    } else {
      deployStatus.textContent = `Initialized ${data.count} encoder${data.count === 1 ? '' : 's'} for rotary-left, rotary-right, and push actions.`;
    }
    deployStatus.style.color = 'var(--lime)';
    await refreshExistingButtons(pageNumber, true);
    renderSurface();
  } catch (problem) {
    deployStatus.textContent = problem.message; deployStatus.style.color = 'var(--red)';
  } finally { updateQuickActionState(); }
}

document.querySelector('#test-connection').addEventListener('click', () => checkConnection());
addressInput.addEventListener('input', updateNetworkOverview);
satelliteAddressInput.addEventListener('input', () => { localStorage.setItem('satellite-address', satelliteAddressInput.value.trim()); updateNetworkOverview(); });
openSatelliteButton.addEventListener('click', () => {
  const host = satelliteAddressInput.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!/^[a-z0-9.:-]+$/i.test(host)) { deployStatus.textContent = 'Enter a valid Satellite IP address or hostname.'; deployStatus.style.color = 'var(--red)'; return; }
  window.open(`http://${host}:9999`, '_blank', 'noopener');
});
deployButton.addEventListener('click', deploy);
syncFromDeviceButton.addEventListener('click', () => syncFromDevice(false));
clearDevicePageButton.addEventListener('click', () => runSurfaceQuickAction('clear-page'));
addLayerScrollButton.addEventListener('click', () => runSurfaceQuickAction('add-layer-scroll'));
initializeEncodersButton.addEventListener('click', () => runSurfaceQuickAction('initialize-encoders'));
deleteSelectedButton.addEventListener('click', deleteSelectedGridItem);
cutSelectedButton.addEventListener('click', () => copyOrCutSelectedButton('cut'));
copySelectedButton.addEventListener('click', () => copyOrCutSelectedButton('copy'));
pasteButton.addEventListener('click', pasteButtonClipboard);
updatePreviewButton.addEventListener('click', () => deploy());
confirmAddButton.addEventListener('click', () => selectedSurface()?.offline ? confirmPendingButtonsOffline() : deploy());
overwriteDeviceLayoutButton.addEventListener('click', () => overwriteDeviceLayout());
mergeDeviceLayoutButton.addEventListener('click', () => mergeDeviceLayout());
savePresetButton.addEventListener('click', () => writePreset(false));
savePresetAsButton.addEventListener('click', () => writePreset(true));
loadPresetButton.addEventListener('click', loadPreset);
presetFileInput.addEventListener('change', async () => {
  const file = presetFileInput.files?.[0];
  if (!file) return;
  try { presetBrowserFileHandle = null; await installPreset(JSON.parse(await file.text()), { path: '', name: file.name }); }
  catch (problem) { deployStatus.textContent = `Could not load preset: ${problem.message}`; deployStatus.style.color = 'var(--red)'; }
  finally { presetFileInput.value = ''; }
});
dictateButton.addEventListener('click', dictate);
refreshAudioInputsButton.addEventListener('click', refreshAudioInputs);
refreshConnectionInventoryButton.addEventListener('click', refreshConnectionInventory);
toggleConnectionRegistryButton.addEventListener('click', () => setConnectionRegistryCollapsed(!connectionRegistrySection.classList.contains('collapsed')));
supportProgressClose.addEventListener('click', () => supportProgressDialog.close());
supportProgressDialog.addEventListener('cancel', (event) => { if (supportProgressClose.disabled) event.preventDefault(); });
audioInputSelect.addEventListener('change', () => localStorage.setItem('audio-input-device', audioInputSelect.value));
audioInputSelect.addEventListener('change', () => { stopAudioMeter(); refreshAudioChannels(); });
audioInputChannelSelect.addEventListener('change', () => { stopAudioMeter(); localStorage.setItem(`audio-input-channel:${audioInputSelect.value}`, audioInputChannelSelect.value); });
window.addEventListener('pagehide', stopAudioMeter);
buttonGraphicSelect.addEventListener('change', applyPreviewGraphicSelection);
targetModuleSelect.addEventListener('change', () => {
  localStorage.setItem('target-module-id', targetModuleSelect.value);
  updateTargetModuleNote();
  setSessionDirty(true);
});
clearTargetModuleButton.addEventListener('click', () => {
  targetModuleSelect.value = '';
  localStorage.removeItem('target-module-id');
  updateTargetModuleNote();
  setSessionDirty(true);
});
document.querySelector('#deck-button').addEventListener('click', togglePreviewState);
document.querySelector('#deck-button').addEventListener('keydown', (event) => {
  if ((event.key === 'Enter' || event.key === ' ') && currentPlan?.button?.appearance?.states) { event.preventDefault(); togglePreviewState(); }
});
addressInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); checkConnection(); } });
modelSelect.addEventListener('change', async () => {
  const requestedModel = modelSelect.value;
  const previousModel = activeDeviceLayer()?.model || 'offline:mk2';
  modelSelect.value = previousModel;
  workspaceSurfaceIds.add(requestedModel);
  setSessionDirty(true);
  await activateWorkspaceSurface(requestedModel);
  validation.textContent = `${MODELS[requestedModel.replace(/^offline:/, '')]?.name || 'Offline template'} · ready`;
  validation.style.color = '';
});
deviceSelect.addEventListener('change', async () => {
  if (deviceSwitchInProgress) return;
  const requestedDeviceId = deviceSelect.value;
  deviceSwitchInProgress = true;
  deviceSwitchTargetId = requestedDeviceId;
  const currentLayer = activeDeviceLayer();
  const previousDeviceId = currentLayer?.deviceId || '';
  if (currentLayer) cacheDevicePlans(previousDeviceId, currentLayer.page, currentPlans);
  const requestedSurface = connectedSurfaces.find((surface) => surface.id === requestedDeviceId);
  let syncChoice = null;
  let transfer = null;
  try {
    if (requestedSurface && deviceSwitchPromptRequested) {
      transfer = compatibleOfflineTransfer(requestedSurface);
      transfer.desiredPageCount = deviceLayers.length;
      syncChoice = await chooseDeviceSync(requestedSurface, transfer);
      if (syncChoice === 'cancel') {
        if (workspacePendingSelectionId === requestedDeviceId) {
          workspaceSurfaceIds.delete(requestedDeviceId);
          persistWorkspaceSelection();
        }
        workspacePendingSelectionId = '';
        deviceSelect.value = previousDeviceId;
        useOfflineTemplate = !previousDeviceId;
        updateOfflineTemplateState();
        renderWorkspacePicker();
        renderSurface();
        return;
      }
    }
  deviceSelect.value = requestedDeviceId;
  if (requestedDeviceId) offlineWorkspaceExplicitlyActivated = false;
  if (requestedDeviceId) workspaceSurfaceIds.add(requestedDeviceId);
  persistWorkspaceSelection();
  useOfflineTemplate = !requestedDeviceId;
  updateOfflineTemplateState();
  localStorage.setItem('use-offline-template', String(useOfflineTemplate));
  if (requestedDeviceId) localStorage.setItem('connected-surface-id', requestedDeviceId);
  for (const layer of deviceLayers) {
    layer.deviceId = requestedDeviceId;
    layer.plans = cachedDevicePlans(requestedDeviceId, layer.page);
  }
  if (currentLayer) {
    currentPlans = structuredClone(currentLayer.plans);
    currentPlan = currentPlans.find((plan) => plan.button.location.page === currentLayer.page) || null;
    await loadDeviceLayer(currentLayer);
  } else {
    await refreshExistingButtons(viewedPage(), true);
    renderSurface();
  }
  localStorage.setItem('device-layouts-v1', JSON.stringify(deviceLayers));
  if (syncChoice === 'device') await syncFromDevice(true);
  else if (syncChoice === 'overwrite') await overwriteDeviceLayout(transfer.accepted, transfer, true);
  else if (syncChoice === 'merge') await mergeDeviceLayout(true);
  } finally {
    deviceSwitchTargetId = '';
    deviceSwitchInProgress = false;
    deviceSwitchPromptRequested = false;
    workspacePendingSelectionId = '';
    renderWorkspacePicker();
    queueMicrotask(continueStartupSurfaceSync);
  }
});
pageInput.addEventListener('change', async () => {
  const requested = Math.max(1, Number(pageInput.value) || 1);
  const layer = deviceLayers.find((item) => item.page === requested);
  if (layer) {
    saveActiveDeviceLayer(); activeDeviceLayerId = layer.id; renderDeviceLayerOptions(layer.id); await loadDeviceLayer(layer);
  } else {
    pageInput.value = String(activeDeviceLayer().page);
    deployStatus.textContent = `Layer ${requested} does not exist in Companion. Use + to create it.`;
    deployStatus.style.color = 'var(--red)';
  }
});
previousPageButton?.addEventListener('click', () => navigateAdjacentDeviceLayer(-1, false));
nextPageButton?.addEventListener('click', () => navigateAdjacentDeviceLayer(1, false));
deviceLayerSelect.addEventListener('change', async () => {
  const nextId = deviceLayerSelect.value;
  saveActiveDeviceLayer();
  activeDeviceLayerId = nextId;
  await loadDeviceLayer(deviceLayers.find((layer) => layer.id === nextId));
});
addDeviceLayerButton.addEventListener('click', async () => {
  if (!deviceSelect.value) {
    saveActiveDeviceLayer();
    const page = deviceLayers.length + 1;
    const layer = { id: `layout-${globalThis.crypto?.randomUUID?.() || Date.now()}`, name: `Layer ${page}`, page, model: modelSelect.value, deviceId: '', plans: [] };
    deviceLayers.push(layer);
    activeDeviceLayerId = layer.id;
    renderDeviceLayerOptions(layer.id);
    await loadDeviceLayer(layer);
    setSessionDirty(true);
    deployStatus.textContent = `${layer.name} added to the offline template.`;
    deployStatus.style.color = 'var(--lime)';
    return;
  }
  if (!companionOnline) return;
  addDeviceLayerButton.disabled = true;
  try {
    const response = await fetch('/api/companion-pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', address: addressInput.value.trim() }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const pagesResponse = await fetch(`/api/companion-pages?address=${encodeURIComponent(addressInput.value.trim())}`);
    const pagesData = await pagesResponse.json();
    if (!pagesResponse.ok) throw new Error(pagesData.error);
    installCompanionLayers(pagesData.pages || []);
    const layer = deviceLayers.at(-1);
    activeDeviceLayerId = layer.id; renderDeviceLayerOptions(layer.id); await loadDeviceLayer(layer);
    deployStatus.textContent = `${layer.name} created in Companion.`; deployStatus.style.color = 'var(--lime)';
  } catch (problem) {
    deployStatus.textContent = problem.message; deployStatus.style.color = 'var(--red)';
  } finally { addDeviceLayerButton.disabled = !companionOnline; }
});
removeDeviceLayerButton.addEventListener('click', async () => {
  if (deviceLayers.length === 1) return;
  const removed = activeDeviceLayer();
  if (!deviceSelect.value) {
    if (!window.confirm(`Remove ${removed.name} from this offline template? Buttons on that layer will be removed.`)) return;
    const removedIndex = deviceLayers.findIndex((layer) => layer.id === removed.id);
    deviceLayers.splice(removedIndex, 1);
    const offlinePrefix = `offline:${modelSelect.value}:`;
    for (const key of Object.keys(devicePlanCache)) if (key.startsWith(offlinePrefix)) delete devicePlanCache[key];
    deviceLayers.forEach((layer, index) => {
      layer.page = index + 1;
      layer.name = `Layer ${layer.page}`;
      for (const plan of layer.plans || []) plan.button.location.page = layer.page;
      cacheDevicePlans('', layer.page, layer.plans || []);
    });
    const next = deviceLayers[Math.min(removedIndex, deviceLayers.length - 1)];
    activeDeviceLayerId = next.id;
    renderDeviceLayerOptions(next.id);
    await loadDeviceLayer(next);
    setSessionDirty(true);
    deployStatus.textContent = `${removed.name} removed from the offline template.`;
    deployStatus.style.color = 'var(--lime)';
    return;
  }
  if (!companionOnline) return;
  if (!window.confirm(`Delete ${removed.name} from Companion? Every button on that layer will be deleted.`)) return;
  removeDeviceLayerButton.disabled = true;
  try {
    const response = await fetch('/api/companion-pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', pageNumber: removed.page, address: addressInput.value.trim() }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const pagesResponse = await fetch(`/api/companion-pages?address=${encodeURIComponent(addressInput.value.trim())}`);
    const pagesData = await pagesResponse.json();
    if (!pagesResponse.ok) throw new Error(pagesData.error);
    installCompanionLayers(pagesData.pages || []);
    await loadDeviceLayer(activeDeviceLayer());
    deployStatus.textContent = `${removed.name} removed from Companion.`; deployStatus.style.color = 'var(--lime)';
  } catch (problem) {
    deployStatus.textContent = problem.message; deployStatus.style.color = 'var(--red)';
  } finally { removeDeviceLayerButton.disabled = !companionOnline || deviceLayers.length === 1; }
});
aiEnabled.addEventListener('change', () => { localStorage.setItem('ai-enabled', String(aiEnabled.checked)); refreshAiOnlineStatus(); });
testButtonsModeButton.addEventListener('click', () => { testButtonsMode = !testButtonsMode; updateTestButtonsMode(); renderSurface(); });
toggleWorkspaceViewButton.addEventListener('click', () => { workspaceViewEnabled = !workspaceViewEnabled; localStorage.setItem('ccb-workspace-view', String(workspaceViewEnabled)); renderSurface(); });
oscTestToggle.addEventListener('click', () => controlOscTestReceiver(oscTestStatus.classList.contains('online') ? 'stop' : 'start'));
oscTestPort.addEventListener('input', () => { oscTestPort.dataset.dirty = 'true'; oscTestApplyPort.textContent = 'Apply New Port'; });
oscTestPort.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); controlOscTestReceiver('start'); } });
oscTestApplyPort.addEventListener('click', () => controlOscTestReceiver('start'));
oscTestSelf.addEventListener('click', selfTestOscReceiver);
for (const control of [quickButtonText, quickTextColor, quickBackgroundColor, quickTextSize]) control.addEventListener('input', () => paintQuickPreview({ preserveTypography: !quickPreviewChangeAffectsTypography(control.id) }));
quickEditApply.addEventListener('click', applySelectedQuickEdit);
oscTestClear.addEventListener('click', () => controlOscTestReceiver('clear'));
form.addEventListener('submit', (event) => { event.preventDefault(); preview(); });
command.addEventListener('input', () => setSessionDirty(true));
command.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); preview(); } });
renderDeviceLayerOptions(deviceLayers.some((layer) => layer.id === activeDeviceLayerId) ? activeDeviceLayerId : deviceLayers[0].id);
setConnectionRegistryCollapsed(localStorage.getItem('connection-registry-collapsed') === 'true');
armLayerEdge(layerEdgeLeft, -1);
armLayerEdge(layerEdgeRight, 1);
loadDeviceLayer(activeDeviceLayer()).then(() => checkConnection());
refreshAiOnlineStatus();
setInterval(refreshAiOnlineStatus, 10000);
refreshOscTestReceiver();
setInterval(refreshOscTestReceiver, 750);
updateNetworkOverview();
refreshAudioInputs();
refreshInstalledModules();
setInterval(() => checkConnection(true), 5000);
setInterval(refreshLiveButtonGraphics, 750);
import { companionSafeFontPercent, recolorCompanionFrame, rgbaFrameLooksBlank } from './appearance.js';
import { companionStartupPolicy, createGraphicFrameRegistry, findPlanAtLocation, firstOpenSurfaceLocation, fitsSurfaceGrid, moveRefreshPages, previewDispositionAfterDeploy, quickPreviewChangeAffectsTypography, resolvePlanTargetSurface, toggleWorkspaceSurfaceSelection } from './ui-state.js';
