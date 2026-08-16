# DiGiCo Quantum insert-control research

## Verified source trace

The public S21_HiJack codec maps input-channel inserts to the DiGiCo Pad address tree:

| CCB capability | Pad path | write value | query | feedback path |
| --- | --- | --- | --- | --- |
| `channel.insertA.enabled` | `/Input_Channels/{channel}/Insert/insert_A_in` | OSC float `1.0` / `0.0` | append `/?` | original unsuffixed path |
| `channel.insertB.enabled` | `/Input_Channels/{channel}/Insert/insert_B_in` | OSC float `1.0` / `0.0` | append `/?` | original unsuffixed path |

Inbound boolean decoding must accept float 0/1, integer 0/1, and OSC true/false. The reference uses UDP OSC framing for Pad messages. Its current Quantum profile describes console receive port 8000 and CCB/iPad receive port 9000 as conventional, operator-configurable defaults.

## Quantum 338 safety status

The address-tree relationship is supported by the public implementation, but that implementation explicitly labels its SD/Quantum wire quirks, ports, and feedback behavior as hypotheses pending a hardware probe. CCB therefore:

- renders and logs the exact packet in dry-run mode;
- permits `/?` read-back probes;
- locks non-dry-run Quantum writes until `quantumWriteVerified` is explicitly enabled after a matching hardware response;
- does not brute-force paths or ports;
- keeps both capabilities data-driven in `src/digico/capabilities.js`.

## Required Quantum 338 validation

1. Configure one DiGiCo Pad external-control device with the actual send/receive ports. Only one Pad client may own the console session.
2. Query insert A and B on a harmless test input and confirm replies arrive on the corresponding unsuffixed paths.
3. Change each insert state on the console and confirm push feedback uses the same path and a recognized boolean encoding.
4. Enable guarded writes and send one state change while the channel is not feeding a live output.
5. Confirm the console UI and reply agree; capture console model/software version and packet log.

No claim of production-safe Quantum 338 insert control should be made until this validation passes.
