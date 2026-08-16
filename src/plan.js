export class PlanValidationError extends Error {
  constructor(errors) {
    super(errors.join(' '));
    this.name = 'PlanValidationError';
    this.errors = errors;
  }
}

export function validateParsedCommand(command) {
  const errors = [];
  const { page, row, column } = command.location;
  const channels = command.action.channels ?? (command.action.channel == null ? [] : [command.action.channel]);
  const auxes = command.action.auxes ?? [];
  const controlGroups = command.action.controlGroups ?? [];

  if (!Number.isInteger(page) || page < 1) errors.push('Page must be a positive integer.');
  if (!Number.isInteger(row) || row < 0) errors.push('Row must be zero or a positive integer.');
  if (!Number.isInteger(column) || column < 0) errors.push('Column must be zero or a positive integer.');
  if (command.action.family === 'midi') {
    if (errors.length) throw new PlanValidationError(errors);
    return command;
  }
  if (command.action.family === 'aux-mute') {
    if (!auxes.length || auxes.some((aux) => !Number.isInteger(aux) || aux < 1 || aux > 12)) errors.push('Every DiGiCo aux must be an integer from 1 through 12.');
  } else if (command.action.family === 'control-group-mute') {
    if (!controlGroups.length || controlGroups.some((group) => !Number.isInteger(group) || group < 1 || group > 24)) errors.push('Every DiGiCo control group must be an integer from 1 through 24.');
  } else if (command.action.family === 'snapshot') {
    if (command.action.operation === 'fire-snapshot' && (!Number.isInteger(command.action.snapshot) || command.action.snapshot < 0 || command.action.snapshot > 9999)) errors.push('Snapshot number must be an integer from 0 through 9999.');
  } else if (command.action.family === 'macro') {
    if (!Number.isInteger(command.action.macro) || command.action.macro < 1 || command.action.macro > 256) errors.push('Macro number must be an integer from 1 through 256.');
  } else if (!channels.length || channels.some((channel) => !Number.isInteger(channel) || channel < 1 || channel > 144)) errors.push('Every DiGiCo channel must be an integer from 1 through 144.');
  if (errors.length) throw new PlanValidationError(errors);
  return command;
}

function labelFor(action, channels) {
  if (action.family === 'channel-insert') return `CH ${channels.join(', ')}\nINSERT ${action.slots.join('+')} ${action.operation === 'toggle-insert' ? 'TOGGLE' : action.operation === 'enable-insert' ? 'ON' : 'BYPASS'}`;
  if (action.family === 'snapshot') return action.operation === 'next-snapshot' ? 'NEXT\nSNAPSHOT' : action.operation === 'previous-snapshot' ? 'PREVIOUS\nSNAPSHOT' : `SNAPSHOT\n${action.snapshot}`;
  if (action.family === 'macro') return `MACRO\n${action.macro}`;
  if (action.family === 'channel-fader') return `CH ${channels.join(', ')}\n${action.levelDb === 'OFF' ? 'OFF' : `${action.levelDb > 0 ? '+' : ''}${action.levelDb} dB`}`;
  const { operation } = action;
  const verb = operation === 'toggle-mute' ? 'TOGGLE' : operation === 'unmute' ? 'UNMUTE' : 'MUTE';
  const prefix = action.family === 'aux-mute' ? 'AUX' : action.family === 'control-group-mute' ? 'CG' : 'CH';
  return `${prefix} ${channels.join(', ')}\n${verb}`;
}

export function buildDeploymentPlan(command, config) {
  validateParsedCommand(command);
  const { operation, family = 'channel-mute' } = command.action;
  if (family === 'midi') {
    const appearance = command.appearance || {};
    return {
      kind: 'create-button', schemaVersion: 1,
      target: { product: 'Bitfocus Companion', version: config.companion.version, address: config.companion.address },
      module: { id: 'generic-midi', version: '1.4.0', connectionLabel: null }, safety: { ...config.safety },
      button: {
        location: { ...command.location }, text: appearance.label,
        appearance: { textColor: appearance.textColor || '#ffffff', backgroundColor: appearance.backgroundColor || '#172b4d' },
        action: { ...command.action }, feedback: null,
        behavior: operation === 'noteon' || operation === 'noteoff' ? `MIDI ${operation === 'noteon' ? 'Note On' : 'Note Off'} · channel ${command.action.channel} · note ${command.action.note} · velocity ${command.action.velocity}`
          : operation === 'momentary-cc' ? `Momentary MIDI CC · press channel ${command.action.channel} controller ${command.action.press.controller} value ${command.action.press.value} · release controller ${command.action.release.controller} value ${command.action.release.value}`
          : operation === 'cc' ? `MIDI CC · channel ${command.action.channel} · controller ${command.action.controller} · value ${command.action.value}`
            : operation === 'program' ? `MIDI Program Change · channel ${command.action.channel} · program ${command.action.program}`
              : operation === 'pitch' ? `MIDI Pitch Wheel · channel ${command.action.channel} · value ${command.action.value}` : `MIDI SysEx · ${command.action.bytes}`,
      },
      deployment: { status: 'ready', reason: 'Validated for Companion 5.0.3 and Generic MIDI 1.4.0 installed action definitions.' },
      sourceText: command.sourceText,
    };
  }
  const channels = command.action.channels ?? (command.action.channel == null ? [] : [command.action.channel]);
  const targets = family === 'aux-mute' ? command.action.auxes : family === 'control-group-mute' ? command.action.controlGroups : family === 'snapshot' || family === 'macro' ? [] : channels;
  const requestedStates = command.appearance?.states || null;
  const defaultText = command.appearance?.textColor ?? '#ffffff';
  const defaultBackground = command.appearance?.backgroundColor ?? (family === 'channel-fader' ? '#174b7a' : operation === 'unmute' ? '#008000' : '#ff0000');
  const stateAppearance = requestedStates ? {
    unmuted: {
      textColor: requestedStates.unmuted?.textColor ?? defaultText,
      backgroundColor: requestedStates.unmuted?.backgroundColor ?? defaultBackground,
    },
    muted: {
      textColor: requestedStates.muted?.textColor ?? '#ffffff',
      backgroundColor: requestedStates.muted?.backgroundColor ?? config.appearance.muted,
    },
  } : null;

  return {
    kind: 'create-button',
    schemaVersion: 1,
    target: {
      product: 'Bitfocus Companion',
      version: config.companion.version,
      address: config.companion.address,
    },
    module: { ...config.module },
    safety: { ...config.safety },
    button: {
      location: { ...command.location },
      text: command.appearance?.label ?? labelFor(command.action, targets),
      appearance: {
        textColor: stateAppearance?.unmuted.textColor ?? defaultText,
        backgroundColor: stateAppearance?.unmuted.backgroundColor ?? defaultBackground,
        ...(stateAppearance ? { states: stateAppearance } : {}),
      },
      action: family === 'snapshot' || family === 'macro' || family === 'channel-insert' ? { ...command.action } : family === 'channel-fader' ? {
        family,
        operation: 'set-fader',
        channels,
        levelDb: command.action.levelDb,
      } : family === 'aux-mute' || family === 'control-group-mute' ? {
        family,
        operation,
        [family === 'aux-mute' ? 'auxes' : 'controlGroups']: targets,
        desiredValue: operation === 'mute' ? true : operation === 'unmute' ? false : null,
      } : {
        family,
        operation,
        channels,
        desiredValue: operation === 'mute' ? true : operation === 'unmute' ? false : null,
      },
      feedback: family === 'channel-insert' ? {
        family: 'digico-pad-state',
        capabilities: command.action.slots.flatMap((slot) => channels.map((channel) => ({ id: `channel.insert${slot}.enabled`, channel }))),
        verification: 'S21 verified; Quantum 338 hardware validation required',
      } : family !== 'channel-mute' ? null : {
        family: 'channel-mute-state',
        channels,
        colors: { ...config.appearance },
      },
      stateFeedback: stateAppearance ? {
        family: 'companion-current-step',
        mutedStep: 2,
        limitation: 'Tracks the Companion toggle step; digico_osc 1.0.4 does not report channel mute state.',
      } : null,
    },
    deployment: {
      status: family === 'channel-insert' ? 'hardware-validation-required' : 'ready',
      reason: family === 'channel-insert'
        ? 'DiGiCo Pad path and OSC encoding are traced from S21_HiJack; Quantum 338 writes remain locked until matching read-back is captured.'
        : 'Validated for Companion 5.0.3 and digico_osc 1.0.4 using the installed module definitions.',
    },
    sourceText: command.sourceText,
  };
}
