export const defaultConfig = Object.freeze({
  companion: {
    version: '5.0.3',
    address: 'http://127.0.0.1:8000',
    defaultPage: 1,
  },
  module: {
    id: 'digico_osc',
    version: '1.0.4',
    connectionLabel: null,
    consoleModel: 'Quantum 338',
  },
  safety: {
    overwriteExisting: false,
    requirePreview: true,
  },
  appearance: {
    muted: '#ff0000',
    unmuted: '#008000',
    unknown: '#444444',
    offline: '#ffbf00',
  },
});

export function mergeConfig(overrides = {}) {
  return {
    companion: { ...defaultConfig.companion, ...overrides.companion },
    module: { ...defaultConfig.module, ...overrides.module },
    safety: { ...defaultConfig.safety, ...overrides.safety },
    appearance: { ...defaultConfig.appearance, ...overrides.appearance },
  };
}
