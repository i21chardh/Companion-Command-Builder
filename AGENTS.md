# Companion Command Builder development instructions

These instructions apply to the entire repository. They capture the product decisions and regression lessons established during development of Companion Command Builder (CCB).

## Product baseline

- Product: Companion Command Builder, a multi-module natural-language layout builder for Bitfocus Companion.
- Current compatibility target: Bitfocus Companion 5.0.3 on macOS, with Apple Silicon packaging.
- Current public repository: `https://github.com/i21chardh/Companion-Command-Builder`.
- Treat the application as a multi-module production utility. Do not restore DiGiCo-specific branding or assumptions in global UI copy.
- Keep the interface focused on the Companion address, available surfaces, connection registry, command entry, button preview, action summary, and surface workspace.
- Phantom-power actions are intentionally excluded everywhere.
- Direct DiGiCo insert extensions are on hold until they can be validated against a physical desk. Do not enable unverified console writes.

## Core behavior

### Deterministic parsing first

- Known production language must be handled deterministically and quickly.
- Ollama is a fallback for genuinely unrecognized language, never the primary parser for established commands.
- A known-module request must never fall through to the DiGiCo parser merely because another adapter is incomplete.
- AI must not invent button-creation actions inside a Companion module schema. CCB owns button creation, placement, appearance, and layout; module schemas provide button actions and feedbacks.
- Fail unsupported requests early with a module-specific, actionable message. Do not wait for an AI timeout when the missing criterion is already known.
- Accept common speech-to-text variations, number words, punctuation mistakes, unmatched quotation marks, `/`, `.`, and spoken `dot` PAGE/ROW/COLUMN forms.
- When a creation prompt omits a location, use the first open usable cell on the selected surface and layer. Explicit coordinates always win. Return a clear grid-full message when no cell is available.
- Multi-button language must produce a batch preview containing every proposed button. Check duplicate locations and device bounds before deployment.
- Every parser fix must add both a focused test and a permanent stress-audit case using the exact failing prompt or a faithful real-world equivalent.

### Coordinates and surfaces

- CCB coordinates must match Companion's native page/row/column cell IDs. Do not add hidden one-based translations or fixed offsets.
- Surface offsets and dimensions come from Companion and can differ by device. Never assume all connected decks share the same origin or grid size.
- Treat every physical Stream Deck as an independent layout workspace, even if Companion groups or pages overlap.
- Multiple selected surfaces may be visible simultaneously. The active target remains explicit.
- Surface previews must appear and disappear with actual connection state and resize to the detected model.
- Companion Satellite starts in the offline editor. Network surfaces are enrolled individually with a sync-direction prompt.
- Keep layer/page navigation adjacent to the preview grid. Layer arrows are disabled when navigation in that direction is unavailable.
- Drag-and-drop, cut, copy, and paste must work both online and offline, including across pages, layers, and devices.
- Moving a button must preserve its complete Companion control: actions, feedbacks, steps, style, graphics, and state. Confirm the destination read-back before clearing the source.

### Preview and confirmation model

- New or edited buttons first appear in the button preview area; they do not enter the grid until the user confirms the add/update.
- Batch prompts show all proposed buttons in preview.
- After a successful create or update, clear the button preview. Move operations may retain relevant selection state.
- Selecting a grid button rehydrates the button preview and quick editor with its current text, module target, actions, colors, font size, and graphics.
- Quick color changes must not change font family, font weight, text wrapping, location graphics, or button scale.
- The preview should use Companion's rendered button image when available. Simulated preview state must preserve the same geometry and typography.
- Online preview buttons should be pressable for testing and refresh state feedback promptly.
- Button text should keep whole words on one line when possible, using Companion-compatible automatic shrinking instead of splitting short words.
- A selected button must show a concise action summary and its target module/connection. Connection host and port information should be visible through the selected-item or connection editor without exposing secrets.

### Online, offline, and synchronization

- CCB starts blank until a device is synchronized or a preset/template is loaded.
- Hide offline templates while physical devices are active; show an offline template only when no device is connected or the user explicitly works offline.
- On first enrollment of a device, prompt for exactly one direction:
  - Sync from Device: Companion is authoritative.
  - Sync from CCB: replace the selected device layout after a warning.
  - Merge from CCB: preserve existing Companion controls and fill only empty positions.
- Normal confirmed online edits must immediately update Companion and the physical surface. Full-layout overwrite is not the normal button-deployment path.
- Loading an offline template while connected requires an explicit overwrite confirmation.
- When Companion disconnects, remove live buttons and surfaces from the workspace and mark associated modules and network data offline. Do not show stale live state as connected.
- Device selection must take effect on the first interaction, not require a second toggle.

## Module adapters and onboarding

- Keep adapters isolated by module ID and installed module version.
- Current priority families include DiGiCo OSC, Shure Wireless/Axient Digital, REAPER, OBS Studio, QLab, ATEM, Waves LV1, Generic MIDI, and Generic OSC.
- The connection registry must show configured Companion connections, active/inactive state, module version, support status, and available configuration editing.
- Users may enable or disable individual target modules. Disabled modules must not receive commands.
- When multiple enabled modules plausibly match a request, require explicit targeting rather than silently choosing.
- New connections must use a setup wizard driven by the installed Companion module schema, including host, port, authentication, and model fields where supplied by that module.
- The onboarding engine should discover actions and feedbacks, compile the adapter, generate realistic production prompt cases, run parser audits, perform temporary-control read-back when possible, and refresh inventory automatically.
- Network/host validation must not block documentation-backed parser and schema configuration. Mark host validation pending while completing all offline gates.
- Once configuration begins, run all remaining stages without repeated Continue clicks. Show progress and a terminal Complete state; hide the Configure button once support is complete.
- Interrupted configurations may be resumed or restarted. Fully completed modules should not regress to discovered/unsupported merely because their external host is offline.
- Language-memory corrections remain scoped to the target module and must never leak learned phrases across adapters.

## Companion deployment safety

- Discover and validate the active Companion connection and exact module version before deployment.
- Never overwrite an occupied control during normal create operations.
- Preserve existing buttons unless the user explicitly chooses an overwrite workflow.
- Roll back or clear partial creations when deployment fails.
- Validate actions against the live Companion schema when available. Do not fabricate fields absent from the installed version.
- Display-only buttons may use documented Companion variables or feedbacks and should not receive meaningless press actions.
- Momentary controls must keep press and release actions in the correct Companion action sets.
- Encoders default to rotary-left, rotary-right, and push groups where supported. Preview encoders and touch strips with their physical form rather than square keys.
- Testing OSC without hardware must use an explicit test receiver or dry-run transport. Never claim physical console validation from a local receiver alone.

## AI, speech, and privacy

- The microphone is active only while the user invokes speech input. An idle CCB window must not hold the microphone.
- Show continuous input level only while the selected capture path is active according to the current UI design; do not silently record audio.
- Respect the selected Core Audio device and channel, and handle sample-rate/channel format mismatches without crashing.
- Speech capture should tolerate normal pauses and should not terminate after only a few seconds.
- Show clear AI online/offline status. CCB must remain useful with Ollama disabled or unavailable.
- Default local model: `qwen3:4b`, with bounded interactive timeout and deterministic fallback behavior.
- Never log or publish credentials, tokens, PINs, private Companion exports, production network inventories, or raw connection secrets.

## Presets and persistence

- Preset format remains `companion-command-builder-layout` with `.ccb-layout` preferred and JSON accepted.
- Save writes the current file, Save As opens a naming/location dialog, and Load opens a file chooser.
- Display an unsaved `*` after any layout mutation and clear it only after a successful save.
- Round-trip every page, surface, button, action, appearance value, and workspace assignment exactly.
- Loading a preset must replace the current offline editor state predictably; stale cached buttons must never flash into a blank workspace.

## UI principles

- Keep the GUI simple, readable, and production-oriented. Prefer collapsible secondary areas such as the connection registry and system log.
- Do not reintroduce the removed large Editing Mode row, redundant deployment-ready status, or redundant push/sync buttons.
- Use clear language: Confirm Add, Update Button, Sync from Device, Sync from CCB, Merge, and confirmed overwrite warnings.
- Avoid controls that appear enabled but have no implementation.
- Include the CCB build number near the Companion version.
- Maintain the system log as the primary reproducible bug record, with credential redaction.

## Testing and audit requirements

- Treat each user-reported failure as a regression candidate, not a one-off patch.
- Add exact or representative prompts to the audit engine for parsing, batching, placement, module routing, preview state, deployment, persistence, and device lifecycle bugs.
- Minimum checks for code changes:
  - `npm test`
  - `npm run audit:stress`
- Before packaging or publishing an application release, run `npm run audit:release` when the required live Companion test connection is available.
- Do not claim hardware validation for equipment that is not physically connected.
- A release gate must report passed, failed, skipped, and live-pending checks honestly.
- Inspect and preserve unrelated user changes. Never delete historical user data merely to make tests pass.

## Versioning and packaging

- Any shipped application behavior change increments the patch version and macOS build number.
- Update all matching version locations together: `package.json`, `src/server.js`, `public/app.js`, `public/index.html` cache keys/footer, `packaging/macos/Info.plist`, and `packaging/build-dmg.sh`.
- Documentation-only repository updates do not require an application version bump or a new DMG/ZIP.
- Build both the arm64 DMG and the `OPEN-THIS-...zip` for application releases.
- Verify the app signature, ZIP integrity, artifact sizes, and release audit before distribution.
- The beta is ad-hoc signed and not notarized; public notes must state the macOS Control-click/Open requirement until Developer ID signing and notarization are implemented.
- Do not commit generated ZIPs, DMGs, `dist/`, local caches, logs, or historical build archives to source control. Attach current binaries to the matching GitHub Release.

## GitHub is part of the definition of done

- Every completed project change must update `https://github.com/i21chardh/Companion-Command-Builder` before reporting completion, unless the user explicitly says not to publish or the work is incomplete/unsafe to release.
- Publish only the intended source and documentation changes. Never publish local configuration, secrets, logs, presets, production IPs, cached Companion data, or historical build folders.
- Keep commit messages concise and describe the completed outcome.
- For ordinary completed revisions in this solo beta repository, update `main` after checks pass. Use a branch or pull request for broad/risky refactors or when requested.
- For application behavior changes:
  1. bump version/build;
  2. run the release gates;
  3. build and verify ZIP/DMG;
  4. update GitHub source;
  5. publish a matching prerelease tag and attach both artifacts;
  6. verify GitHub reports both assets as uploaded.
- For documentation-only changes, commit the documentation to GitHub without generating a new application release.
- Final responses should link the updated repository, commit or release, and downloadable artifacts when applicable.

## Definition of done

A change is complete only when:

1. The requested behavior works in the appropriate online/offline context.
2. Existing behavior and user data are preserved.
3. A focused regression test and stress-audit coverage exist when behavior changed.
4. Relevant test gates pass.
5. Versioned artifacts are rebuilt and verified when application behavior changed.
6. The sanitized source update is published to GitHub.
7. The user receives a concise summary, validation results, and GitHub/release links.
