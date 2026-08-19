import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appPath = new URL('../public/app.js', import.meta.url);
const htmlPath = new URL('../public/index.html', import.meta.url);
const deployCssPath = new URL('../public/deploy.css', import.meta.url);

test('multi-surface workspace retains one active target and many visible surfaces', async () => {
  const workspaceCssPath = new URL('../public/workspace.css', import.meta.url);
  const [app, html, workspaceCss] = await Promise.all([readFile(appPath, 'utf8'), readFile(htmlPath, 'utf8'), readFile(workspaceCssPath, 'utf8')]);
  assert.match(html, /id="workspace-device-picker"/);
  assert.match(html, /id="workspace-surfaces"/);
  assert.match(html, /id="toggle-workspace-view"/);
  assert.match(app, /const savedWorkspaceSurfaceIds = localStorage\.getItem\('ccb-workspace-surfaces'\)/);
  assert.match(app, /new Set\(JSON\.parse\(savedWorkspaceSurfaceIds \|\| '\[\]'\)\)/);
  assert.match(app, /selectedWorkspaceSurfaces\(\)/);
  assert.match(app, /dropWorkspaceButton\(targetSurface, target\)/);
  assert.match(app, /document\.querySelector\('#active-workspace-surface'\)\?\.after\(layerEdgeRight\)/);
  assert.match(app, /document\.querySelector\('\.surface-stage'\)\?\.append\(layerEdgeRight\)/);
  assert.match(workspaceCss, /\.workspace-surfaces\.inter-grid-navigation\s*\{[^}]*display:\s*flex/);
  assert.match(workspaceCss, /\.workspace-surfaces\s*>\s*\.layer-edge\s*\{[^}]*flex:\s*0 0 58px/);
  assert.match(workspaceCss, /\.surface\.workspace-expanded \.workspace-stage\s*\{[^}]*grid-template-columns:\s*58px minmax\(0,1fr\)/);
});

test('workspace filters disconnected devices and keeps a single grid coordinate band', async () => {
  const [app, deployCss] = await Promise.all([readFile(appPath, 'utf8'), readFile(deployCssPath, 'utf8')]);
  assert.match(app, /surface\.offline \|\| surface\.connected !== false/);
  assert.match(app, /key\.textContent = ''/);
  assert.match(app, /coordinateLabel\.textContent = `\$\{page\}\/\$\{actualRow\}\/\$\{actualColumn\}`/);
  assert.match(app, /cell\.append\(coordinateLabel, key\)/);
  assert.match(deployCss, /\.surface-cell\{[^}]*flex-direction:column/);
  assert.match(deployCss, /\.surface-key-coordinate\{[^}]*position:static/);
  assert.doesNotMatch(deployCss, /\.surface-key-coordinate\{[^}]*position:absolute/);
});

test('selecting an online workspace surface always presents the sync-direction dialog', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.doesNotMatch(app, /workspaceActivationMode/);
  assert.match(app, /newlySelectedOnlineSurface/);
  assert.match(app, /workspacePendingSelectionId = surface\.id/);
  assert.match(app, /requestedSurface && deviceSwitchPromptRequested/);
  assert.match(app, /syncChoice = await chooseDeviceSync\(requestedSurface, transfer\)/);
  assert.match(app, /workspacePendingSelectionId === requestedDeviceId/);
});

test('direct physical surfaces replace the fallback while Satellite starts offline', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.match(app, /previouslyHadOnlineSurface/);
  assert.match(app, /satelliteStartupOffline/);
  assert.match(app, /workspaceSurfaceIds = new Set\(\[modelSelect\.value\]\)/);
  assert.match(app, /workspaceSurfaceIds = new Set\(\[\.\.\.workspaceSurfaceIds\]\.filter\(\(id\) => !String\(id\)\.startsWith\('offline:'\)\)\)/);
  assert.match(app, /for \(const surface of online\) workspaceSurfaceIds\.add\(surface\.id\)/);
  assert.match(app, /for \(const surface of online\) workspaceSurfaceIds\.add\(surface\.id\);[\s\S]{0,700}layoutSourceActivated = true/);
  assert.match(app, /else if \(!online\.length \|\| satelliteStartupOffline\) \{\s*useOfflineTemplate = true/);
});

test('all physical surfaces hydrate their own Companion button caches', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.match(app, /const online = selectedWorkspaceSurfaces\(\)\.filter/);
  assert.match(app, /await Promise\.all\(online\.map\(async \(surface\) =>/);
  assert.match(app, /workspaceButtonCache\.set\(workspaceCacheKey\(surface\.id, page\), structuredClone\(buttons\)\)/);
});

test('startup prompts once per connected surface while normal grid activation does not prompt', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.match(app, /startupSurfaceSyncInitialized/);
  assert.match(app, /startupSurfaceSyncQueue = surfaces\.map\(\(surface\) => surface\.id\)/);
  assert.match(app, /activateWorkspaceSurface\(surfaceId, \{ promptSync: true \}\)/);
  assert.match(app, /companionStartupPolicy\(attached\)\.autoPromptStartupSync/);
  assert.match(app, /requestedSurface && deviceSwitchPromptRequested/);
  assert.match(app, /Make Active'[\s\S]{0,160}activateWorkspaceSurface\(surface\.id\)/);
});

test('offline surfaces remain available beside connected devices in one workspace picker', async () => {
  const [app, html] = await Promise.all([readFile(appPath, 'utf8'), readFile(htmlPath, 'utf8')]);
  assert.match(app, /const available = \[\.\.\.onlineSurfaces, \.\.\.disconnectedSatelliteSurfaces, \.\.\.offlineSurfaces\]/);
  assert.match(app, /Mix connected devices and offline templates; online enrollment keeps its sync-direction prompt/);
  assert.match(html, /<div class="hidden" aria-hidden="true">\s*<select id="surface-model" tabindex="-1">/);
  assert.doesNotMatch(html, /<label for="surface-model">Offline template<\/label>/);
  assert.match(app, /No physical devices detected · choose an offline template/);
  assert.match(app, /if \(online\.length > 1\) \{\s*workspaceViewEnabled = true/);
});

test('configured but disconnected Satellite surfaces remain visible and cannot be enrolled', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.match(app, /const disconnectedSatelliteSurfaces = connectedSurfaces\.filter\(\(surface\) => surface\.satellite && surface\.connected === false\)/);
  assert.match(app, /const available = \[\.\.\.onlineSurfaces, \.\.\.disconnectedSatelliteSurfaces, \.\.\.offlineSurfaces\]/);
  assert.match(app, /input\.disabled = \(!surface\.offline && surface\.connected === false\) \|\| heldElsewhere/);
  assert.match(app, /Companion Satellite · Offline — reconnect to enroll/);
  assert.match(app, /configured · offline in Companion/);
});

test('shared workspace custody exposes every announced surface and locks remote selections', async () => {
  const [app, html] = await Promise.all([readFile(appPath, 'utf8'), readFile(htmlPath, 'utf8')]);
  assert.match(html, /id="ccb-operator-name"/);
  assert.match(html, /id="ccb-custody-status"/);
  assert.match(html, />3110<\/i> CCB custody/);
  assert.match(app, /collaborationRequest\('announce', \{ surfaceIds: locallyOnline \}\)/);
  assert.match(app, /custodyOnlineSurfaceIds\.has\(surface\.id\) \? \{ \.\.\.surface, connected: true \}/);
  assert.match(app, /const heldElsewhere = Boolean\(lease && lease\.ownerId !== custodyClientId\)/);
  assert.match(app, /input\.disabled = \(!surface\.offline && surface\.connected === false\) \|\| heldElsewhere/);
  assert.match(app, /In use by \$\{lease\.ownerName\}/);
  assert.match(app, /newlySelectedOnlineSurface && !\(await acquireSurfaceCustody\(surface\.id\)\)/);
  assert.match(app, /!surface\.offline && !input\.checked\) await releaseSurfaceCustody\(surface\.id\)/);
  assert.match(app, /collaborationRequest\('heartbeat', \{ surfaceIds: desiredOnlineCustodyIds\(\) \}\)/);
});

test('Satellite address participates in live surface discovery and refreshes on commit', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /companion-surfaces\?address=\$\{encodeURIComponent\(address\)\}&satelliteAddress=\$\{encodeURIComponent\(satelliteAddress\)\}/);
  assert.match(app, /satelliteAddressInput\.addEventListener\('change', \(\) => checkConnection\(\)\)/);
});

test('offline workspace permits an empty surface selection without restoring 5x3', async () => {
  const app = await readFile(appPath, 'utf8');
  assert.doesNotMatch(app, /if \(!workspaceSurfaceIds\.size\) \{ workspaceSurfaceIds\.add\(selectedSurface\(\)\?\.id \|\| modelSelect\.value\); input\.checked = true; \}/);
  assert.doesNotMatch(app, /if \(active\?\.id\) workspaceSurfaceIds\.add\(active\.id\)/);
  assert.doesNotMatch(app, /if \(!workspaceSurfaceIds\.size\) workspaceSurfaceIds\.add\(target\?\.id \|\| modelSelect\.value\)/);
  assert.match(app, /const target = !workspaceSurfaceIds\.size \? null : satelliteStartupOffline \? null/);
  assert.match(app, /activeWorkspaceName\.textContent = 'No surface selected'/);
  assert.match(app, /toggleWorkspaceSurfaceSelection\(\[\.\.\.workspaceSurfaceIds\], surface\.id, input\.checked, activeBefore\)/);
});

test('the redundant editing-mode status row is absent from the GUI', async () => {
  const [app, html] = await Promise.all([readFile(appPath, 'utf8'), readFile(htmlPath, 'utf8')]);
  assert.doesNotMatch(html, /EDITING MODE|id="transfer-mode"|class="transfer-bar/);
  assert.doesNotMatch(app, /#transfer-mode/);
});
