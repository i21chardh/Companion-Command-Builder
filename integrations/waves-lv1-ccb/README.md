# CCB LV1 relative-encoder extension

CCB uses the open-source `waves-lv1` Companion module as its native macOS
transport for Waves eMotion LV1. This integration does not contain or
redistribute code extracted from the proprietary GainStage application.

The patches in this directory apply to `waves-lv1` 1.1.0 and add:

- `outGainRelative`: state-aware channel-output adjustment in dB.
- `sendGainRelative`: state-aware input-to-aux adjustment in dB.
- numeric feedback handling for integer, float, and double send-gain updates.
- clamping to the LV1 fader range (`-144` through `+10` dB).
- endpoint-scoped persistence of observed output/send gains so relative encoders resume safely after Companion restarts.
- stable host-scoped persistence that survives LV1's discovery port changing between sessions.

CCB maps counterclockwise rotation to a negative delta and clockwise rotation
to a positive delta. Version 1.1.4 reads `/Get/Sends` before each relative send
adjustment and parses the bulk `/Notify/Sends` reply. Turns are serialized so
successive adjustments use fresh console values. A missing reply skips the
adjustment; persisted gains never substitute for fresh send feedback.

## Build

1. Clone `https://github.com/bitfocus/companion-module-waves-lv1` at version
   `1.1.0`.
2. Apply `waves-lv1-1.1.1-relative-encoders.patch`, `waves-lv1-1.1.2-reconnect-cache.patch`, then `waves-lv1-1.1.3-stable-endpoint-cache.patch`.
3. Install dependencies and run the module compiler and
   `companion-module-check`.
4. Build the 1.1.4 package with `node integrations/waves-lv1-ccb/build-send-state.mjs <1.1.3-package-directory> <new-output-directory>`.
5. Archive that directory as `pkg/` inside `waves-lv1-1.1.4.tgz` and load it into Companion.

The upstream module and these extensions are MIT licensed. The 1.1.4 send query
and rotary path were verified against the connected LV1: channel 45 to Mon 16
read 0 dB, a left turn read back -1 dB, and a right turn read back 0 dB, including
the first turn after restarting Companion. This covers that path rather than
every module action or LV1 version.
