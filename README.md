# Companion Command Builder

Companion Command Builder (CCB) turns plain-language production commands into previewable, validated button layouts for [Bitfocus Companion](https://bitfocus.io/companion).

CCB is currently a beta for Companion 5.0.3 on macOS. It is an independent project and is not affiliated with or endorsed by Bitfocus, Elgato, or the manufacturers represented by Companion modules.

## Highlights

- Browser-based layout editor packaged as a native macOS utility
- Automatic discovery of connected Companion surfaces and configured connections
- Shared surface custody for multiple CCB workstations using one central Companion server
- Independent multi-surface workspaces with Companion-native page/row/column coordinates
- Offline Stream Deck templates, multiple layers, drag-and-drop, cut/copy/paste, and preset files
- Button preview and full-surface preview before confirmation
- Safe synchronization, merge, and explicit overwrite workflows
- Apple speech-to-text input and optional local Ollama interpretation
- Deterministic parsing and automated regression audits for supported production modules

## Supported module families

The current beta includes audited support or onboarding infrastructure for:

- DiGiCo OSC
- Shure Wireless / Axient Digital
- Cockos REAPER
- OBS Studio
- Figure 53 QLab
- Blackmagic Design ATEM
- Waves LV1
- Generic MIDI
- Generic OSC

Support depends on the exact Companion module version and the actions exposed by the configured device model. Phantom-power operations are intentionally excluded. Experimental DiGiCo insert control remains guarded until it can be validated against physical console hardware.

## Install the macOS beta

1. Download the latest ZIP or DMG from the repository's **Releases** page.
2. Copy **Companion Command Builder.app** to `/Applications`.
3. Start Bitfocus Companion 5.0.3.
4. Open CCB and connect it to the Companion address, normally `127.0.0.1:8000`.

The beta is ad-hoc signed but not Apple-notarized. On first launch, macOS may require **Control-click → Open**.

## Run from source

Requirements:

- Node.js 20 or newer
- Bitfocus Companion 5.0.3 for live device integration
- Ollama only if local AI interpretation is desired

```sh
npm install
npm test
npm run web
```

Open `http://127.0.0.1:3100`.

The project currently has no runtime npm dependencies. The lockfile is retained for reproducible tooling.

## Multiple CCB workstations

Run Companion and one CCB instance on the central server computer. Remote CCB instances connect to that same Companion address. The central CCB coordinates surface presence and exclusive editing custody over TCP port `3110`:

- Every CCB can see all surfaces announced by the participating workstations.
- Selecting an online surface reserves it for that CCB instance.
- Other users see who holds the surface, but cannot select or edit it.
- Unchecking the surface releases it immediately. Custody also expires about 15 seconds after an owner closes or loses connectivity.
- If the coordinator becomes unavailable after use, network editing fails closed until it reconnects; offline templates remain available.

Allow inbound TCP `3110` to the central CCB computer in the macOS firewall. Keep Companion ports `8000`, `16622`, `16623`, and CCB port `3110` on a trusted production VLAN or VPN only; the custody protocol is not intended for public internet exposure.

## Example prompts

```text
Create a toggle mute button for channels 20 through 28 on 2.1.4
Create a blue and green toggle button that fires DiGiCo macro 1 at 1.2.3
Create REAPER transport controls at 1.1.4
Create two buttons at 1.1.1 and 1.2.1 that show selected channel gain and frequency for Shure
Make a momentary button with MIDI channel 1 CC 12 on press and CC 14 on release at 1.2.3
```

When a creation prompt omits its location, CCB uses the first open cell on the selected surface and layer. Explicit positions use Companion's native `PAGE.ROW.COLUMN` values.

## Local AI and privacy

Known commands are parsed deterministically first. Optional Ollama fallback translates unfamiliar wording into the same validated plan format; it does not bypass module schemas or deployment confirmation.

```sh
ollama pull qwen3:4b
```

Ollama defaults to `http://127.0.0.1:11434`. Set `OLLAMA_DISABLED=1` to disable AI interpretation. CCB does not require an OpenAI API key.

## Safety model

- New buttons remain in preview until confirmed.
- Normal edits do not overwrite unrelated Companion controls.
- Merge fills empty positions and preserves existing buttons.
- Full-layout replacement is a separate, warned operation.
- Unsupported module actions fail explicitly instead of being guessed.
- Connection secrets and API credentials are filtered from the system log.

## Auditing

```sh
npm test
npm run audit:stress
npm run audit:release
```

`audit:release` includes live checks and therefore expects the required Companion test connections to be available. The offline test and stress suites can run without production hardware.

## Build the macOS application

On Apple Silicon macOS:

```sh
./packaging/build-dmg.sh
```

The output is written to `dist/`. Public notarized distribution requires an Apple Developer ID certificate and Apple's notarization workflow; the repository build is intended for beta testing.

## Project status

This is beta software for production-control workflows. Test layouts away from a live show, verify every generated action in Companion, and keep a backup of the Companion configuration before using overwrite operations.

Issues and reproducible prompt examples are welcome through GitHub Issues.

## License

Companion Command Builder is available under the [MIT License](LICENSE).
