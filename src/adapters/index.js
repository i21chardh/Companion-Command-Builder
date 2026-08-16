import { digicoOscAdapter } from './digico-osc.js';
import { shureWirelessAdapter } from './shure-wireless.js';
import { wavesLv1Adapter } from './waves-lv1.js';
import { genericMidiAdapter } from './generic-midi.js';
export { ADAPTER_DEVELOPMENT_QUEUE, adapterDevelopmentQueue, isAudioConsoleModule } from './catalog.js';

export const ADAPTERS = Object.freeze(new Map([
  [digicoOscAdapter.moduleId, digicoOscAdapter],
  [shureWirelessAdapter.moduleId, shureWirelessAdapter],
  [wavesLv1Adapter.moduleId, wavesLv1Adapter],
  [genericMidiAdapter.moduleId, genericMidiAdapter],
]));

export function buildConnectionRegistry(connections) {
  return connections.map((connection) => {
    const adapter = ADAPTERS.get(connection.moduleId);
    if (!adapter) return { ...connection, adapter: { status: 'discovered', verification: 'unmapped', compatible: false, capabilities: [], graphics: [] } };
    const compatible = adapter.supportedVersions.includes(connection.moduleVersionId);
    return {
      ...connection,
      adapter: {
        status: compatible ? 'supported' : 'version-mismatch',
        verification: adapter.verification,
        compatible,
        displayName: adapter.displayName,
        category: adapter.category,
        supportedVersions: adapter.supportedVersions,
        capabilities: adapter.capabilities,
        graphics: adapter.graphics.map((graphic) => ({ ...graphic, id: `${adapter.moduleId}:${graphic.id}` })),
      },
    };
  });
}
