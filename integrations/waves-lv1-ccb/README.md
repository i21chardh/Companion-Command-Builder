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

CCB maps counterclockwise rotation to a negative delta and clockwise rotation
to a positive delta. If LV1 has not supplied a current value, the module skips
the adjustment instead of inventing a starting value.

## Build

1. Clone `https://github.com/bitfocus/companion-module-waves-lv1` at version
   `1.1.0`.
2. Apply `waves-lv1-1.1.1-relative-encoders.patch`, then `waves-lv1-1.1.2-reconnect-cache.patch`.
3. Install dependencies and run the module compiler and
   `companion-module-check`.
4. Load the resulting `waves-lv1-1.1.2.tgz` into Companion.

The upstream module and this patch are MIT licensed. Physical LV1 validation
remains required before claiming console-tested status.
