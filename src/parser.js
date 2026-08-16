const CHANNEL_WORD = '(?:channels?|ch|inputs?(?: channels?)?)';
const NUMBER_WORD_VALUES = Object.freeze({ zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 });
const NUMBER_TOKEN = '(?:\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
const POSITION_PATTERNS = [
  new RegExp(`(?:in|at|on)?\\s*column\\s+(?<column>\\d+)\\s*(?:,|and)?\\s*row\\s+(?<row>\\d+)`, 'i'),
  new RegExp(`(?:in|at|on)?\\s*row\\s+(?<row>\\d+)\\s*(?:,|and)?\\s*column\\s+(?<column>\\d+)`, 'i'),
];
const LOCATION_SHORTHAND = new RegExp(`(?:^|[\\s,;:(])(?<page>${NUMBER_TOKEN})\\s*(?:\\/|\\.|\\bdot\\b)\\s*(?<row>${NUMBER_TOKEN})\\s*(?:\\/|\\.|\\bdot\\b)\\s*(?<column>${NUMBER_TOKEN})(?=$|[\\s,;).])`, 'i');

function numberValue(value) {
  const normalized = String(value).toLowerCase();
  return /^\d+$/.test(normalized) ? Number(normalized) : NUMBER_WORD_VALUES[normalized];
}

export class CommandParseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CommandParseError';
    this.details = details;
  }
}

function readPosition(text) {
  for (const pattern of POSITION_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { row: Number(match.groups.row), column: Number(match.groups.column) };
  }
  throw new CommandParseError('A button location is required (for example: column 1 row 3 or 1/3/1 for PAGE/ROW/COLUMN).');
}

function readPage(text, defaultPage) {
  const match = text.match(/\bpage\s+(\d+)\b/i);
  return match ? Number(match[1]) : defaultPage;
}

function readLocation(text, defaultPage) {
  const shorthand = text.match(LOCATION_SHORTHAND);
  if (shorthand) return {
    location: { page: numberValue(shorthand.groups.page), row: numberValue(shorthand.groups.row), column: numberValue(shorthand.groups.column) },
    actionText: `${text.slice(0, shorthand.index)} ${text.slice(shorthand.index + shorthand[0].length)}`,
  };
  return { location: { page: readPage(text, defaultPage), ...readPosition(text) }, actionText: text };
}

function readOperation(text) {
  if (/\b(?:toggles?|switch(?:es)?|flips?)(?:-|\s)+(?:the\s+)?mute(?:\s+state)?\b/i.test(text)
    || /\b(?:flip-flop|toggle)(?:-|\s)+mute\b/i.test(text)
    || /\bmute\b.{0,24}\b(?:toggles?|switch(?:es)?|flips?)\b/i.test(text)) return 'toggle-mute';
  if (/\bunmutes?\b/i.test(text)) return 'unmute';
  if (/\bmutes?\b/i.test(text)) return 'mute';
  throw new CommandParseError('Only mute, unmute, and toggle mute commands are supported in this release.');
}

function readChannels(text) {
  const list = text.match(/\b(?:channels?|inputs?)\s*(?:number|#)?\s*(.+?)(?=\s+(?:on|at|in)\s+(?:page|row|column)\b|\s+with\b|$)/i);
  if (list) {
    const expanded = list[1].replace(/(\d+)\s*(?:through|to|-|–|—)\s*(\d+)/gi, (_, startText, endText) => {
      const start = Number(startText);
      const end = Number(endText);
      if (end < start) throw new CommandParseError(`Channel range ${start}–${end} must be in ascending order.`);
      return Array.from({ length: end - start + 1 }, (__, index) => start + index).join(',');
    });
    const channels = [...expanded.matchAll(/\d+/g)].map((match) => Number(match[0]));
    if (channels.length) return [...new Set(channels)];
  }

  const single = text.match(new RegExp(`\\b${CHANNEL_WORD}\\s*(?:number|#)?\\s*(\\d+)\\b`, 'i'));
  if (!single) throw new CommandParseError('At least one numeric DiGiCo channel is required.');
  return [Number(single[1])];
}

function readAuxes(text) {
  const list = text.match(/\baux(?:es)?\s*(?:number|#)?\s*(.+?)(?=\s+(?:on|at|in)\s+(?:page|row|column)\b|\s+(?:with|labeled|labelled|called)\b|$)/i);
  if (!list) throw new CommandParseError('At least one numeric DiGiCo aux is required.');
  const expanded = list[1].replace(/(\d+)\s*(?:through|to|-|–|—)\s*(\d+)/gi, (_, startText, endText) => {
    const start = Number(startText);
    const end = Number(endText);
    if (end < start) throw new CommandParseError(`Aux range ${start}–${end} must be in ascending order.`);
    return Array.from({ length: end - start + 1 }, (__, index) => start + index).join(',');
  });
  const auxes = [...expanded.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (!auxes.length) throw new CommandParseError('At least one numeric DiGiCo aux is required.');
  return [...new Set(auxes)];
}

function readControlGroups(text) {
  const list = text.match(/\b(?:control groups?|CGs?)\s*(?:number|#)?\s*(.+?)(?=\s+(?:on|at|in|using)\s+(?:page|row|column)\b|\s+(?:with|labeled|labelled|called|and\s+call)\b|$)/i);
  if (!list) throw new CommandParseError('At least one numeric DiGiCo control group is required.');
  const expanded = list[1].replace(/(\d+)\s*(?:through|to|-|–|—)\s*(\d+)/gi, (_, startText, endText) => {
    const start = Number(startText);
    const end = Number(endText);
    if (end < start) throw new CommandParseError(`Control-group range ${start}–${end} must be in ascending order.`);
    return Array.from({ length: end - start + 1 }, (__, index) => start + index).join(',');
  });
  const controlGroups = [...expanded.matchAll(/\d+/g)].map((match) => Number(match[0]));
  if (!controlGroups.length) throw new CommandParseError('At least one numeric DiGiCo control group is required.');
  return [...new Set(controlGroups)];
}

const COLORS = Object.freeze({
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ff8c00', gray: '#808080', grey: '#808080', purple: '#800080',
});

function readAppearance(text) {
  const colorWord = '(black|white|red|green|blue|yellow|orange|gr[ae]y|purple)';
  const textColor = text.match(new RegExp(`\\b${colorWord}\\s+(?:font|text|tech)\\b`, 'i'));
  const backgroundColor = text.match(new RegExp(`\\b${colorWord}\\s+(?:background|button)\\b`, 'i'));
  const shorthandColors = text.match(new RegExp(`\\b${colorWord}\\s+(?:and|on)\\s+${colorWord}\\s+(?:(?:toggle|push|streamdeck)\\s+)?button\\b`, 'i'));
  const label = text.match(/["“]([^"”]+)["”]\s+(?:for|as)\s+(?:the\s+)?text\b/i)
    ?? text.match(/\b(?:text|label(?:ed)?|labled)(?:\s+(?:the\s+button|it))?\s+["“]([^"”]+)["”]/i)
    ?? text.match(/\b(?:label(?:ed)?|labled)\s+(.+?)(?=\s+on\s+\d+\s*\/\s*\d+\s*\/\s*\d+\b)/i)
    ?? text.match(/\b(?:label(?:ed)?|labelled|labled)\s+([^,.;]+?)[.!]?$/i)
    ?? text.match(/\b(?:label(?:ed)?|labled)\s+([^"“][^,.;]*?)(?=\s+(?:on|at|to|for|with)\b|$)/i)
    ?? text.match(/\bcall(?:ed)?(?:\s+it)?\s+["“]([^"”]+)["”]/i);
  const states = {};
  const clausePattern = /([\s\S]*?)\b(?:when|while)\s+(unmuted|muted)\b/gi;
  let clause;
  while ((clause = clausePattern.exec(text))) {
    const style = {};
    for (const color of clause[1].matchAll(/\b(black|white|red|green|blue|yellow|orange|gr[ae]y|purple)\s+(font|text|background|button)\b/gi)) {
      if (/font|text/i.test(color[2])) style.textColor = COLORS[color[1].toLowerCase()];
      else style.backgroundColor = COLORS[color[1].toLowerCase()];
    }
    if (Object.keys(style).length) states[clause[2].toLowerCase()] = style;
  }
  const appearance = {
    ...(label ? { label: label[1].trim() } : {}),
    ...(textColor || shorthandColors ? { textColor: COLORS[(textColor?.[1] || shorthandColors[1]).toLowerCase()] } : {}),
    ...(backgroundColor || shorthandColors ? { backgroundColor: COLORS[(backgroundColor?.[1] || shorthandColors[2]).toLowerCase()] } : {}),
    ...(Object.keys(states).length ? { states } : {}),
  };
  const wantsInversion = /\binvert(?:s|ed)?\s+(?:the\s+)?colors?\b|\bcolors?\s+(?:that\s+)?invert/i.test(text);
  const wantsVisualToggle = /\btoggle\s+button\b/i.test(text);
  if ((wantsInversion || wantsVisualToggle) && appearance.textColor && appearance.backgroundColor && !appearance.states) {
    appearance.states = {
      unmuted: { textColor: appearance.textColor, backgroundColor: appearance.backgroundColor },
      muted: { textColor: appearance.backgroundColor, backgroundColor: appearance.textColor },
    };
  }
  return appearance;
}

function rejectUnsupportedCapabilities(text) {
  const unsupported = [
    [/\bwaits?\b/i, 'Ordered actions and waits'],
    [/\bgroup outputs?\b/i, 'Group-output mute'],
    [/\bsolo(?:s|ed)?\b/i, 'Solo'],
    [/\bphantom(?:\s+power)?\b/i, 'Phantom power'],
  ];
  const match = unsupported.find(([pattern]) => pattern.test(text));
  if (match) throw new CommandParseError(`${match[1]} commands are not supported.`, { aiEligible: false });
}

function readInsertAction(text) {
  const slots = [...text.matchAll(/\binsert\s*([ab])\b/gi)].map((match) => match[1].toUpperCase());
  if (!slots.length) throw new CommandParseError('Specify Insert A or Insert B.');
  const uniqueSlots = [...new Set(slots)];
  const operation = /\b(?:toggle|flip|switch)\b/i.test(text) ? 'toggle-insert'
    : /\b(?:bypass(?:ed)?|disable[sd]?|off)\b/i.test(text) ? 'disable-insert'
      : /\b(?:enable[sd]?|engage[sd]?|on)\b/i.test(text) ? 'enable-insert' : null;
  if (!operation) throw new CommandParseError('Specify enable, bypass/disable, or toggle for the insert.');
  return { family: 'channel-insert', operation, slots: uniqueSlots, channels: readChannels(text), transport: 'digico-pad' };
}

function readSnapshotAction(text) {
  if (/\b(?:next|advance)\s+snapshot\b|\bsnapshot\s+(?:next|advance)\b/i.test(text)) return { family: 'snapshot', operation: 'next-snapshot' };
  if (/\b(?:previous|prev|back)\s+snapshot\b|\bsnapshot\s+(?:previous|prev|back)\b/i.test(text)) return { family: 'snapshot', operation: 'previous-snapshot' };
  const match = text.match(/\bsnapshot\s+(?:number\s+|#\s*)?(\d+)\b/i);
  if (!match) throw new CommandParseError('A snapshot number, next snapshot, or previous snapshot is required.');
  const snapshot = Number(match[1]);
  if (snapshot < 0 || snapshot > 9999) throw new CommandParseError('Snapshot number must be from 0 through 9999.');
  return { family: 'snapshot', operation: 'fire-snapshot', snapshot };
}

function readMacroAction(text) {
  const match = text.match(new RegExp(`\\bmacro\\s+(?:number\\s+|#\\s*)?(${NUMBER_TOKEN})\\b`, 'i'));
  if (!match) throw new CommandParseError('A DiGiCo macro number is required.');
  const macro = numberValue(match[1]);
  if (macro < 1 || macro > 256) throw new CommandParseError('Macro number must be from 1 through 256.');
  return { family: 'macro', operation: 'fire-macro', macro };
}

const FADER_LEVELS = new Set([10,9,8,7,6,5,4,3,2,1,0,-1,-2,-3,-4,-5,-6,-7,-8,-9,-10,-12,-14,-16,-18,-20,-22,-24,-26,-28,-30,-40,-50,-66]);

const EXPLICIT_MODULES = Object.freeze([
  { moduleId: 'obs-studio', pattern: /\bOBS(?:\s+Studio)?\b/i, name: 'OBS Studio' },
  { moduleId: 'bmd-atem', pattern: /\bATEM\b/i, name: 'Blackmagic ATEM' },
  { moduleId: 'generic-midi', pattern: /\bMIDI\b/i, name: 'Generic MIDI' },
  { moduleId: 'generic-osc', pattern: /\b(?:Generic\s+OSC|OSC\s+(?:address|command|toggle|button|reset))\b/i, name: 'Generic OSC' },
  { moduleId: 'waves-lv1', pattern: /\b(?:Waves\s+)?LV1\b/i, name: 'Waves LV1' },
  { moduleId: 'figure53-qlab-advance', pattern: /\bQLab\b/i, name: 'Figure 53 QLab' },
  { moduleId: 'shure-wireless', pattern: /\b(?:Shure|Axient(?:\s+Digital)?|AD4[DQ])\b/i, name: 'Shure Wireless / Axient Digital' },
]);

function guardExplicitModuleRouting(text, targetModuleId) {
  const requested = EXPLICIT_MODULES.find((module) => module.pattern.test(text));
  if (targetModuleId && requested && requested.moduleId !== targetModuleId) {
    throw new CommandParseError(`This prompt names ${requested.name}, but the selected target module is ${targetModuleId}. Select the matching module or Auto Detect.`, {
      code: 'MODULE_TARGET_MISMATCH', moduleId: requested.moduleId, targetModuleId, aiEligible: false,
    });
  }
  const selected = targetModuleId
    ? EXPLICIT_MODULES.find((module) => module.moduleId === targetModuleId) || { moduleId: targetModuleId, name: targetModuleId }
    : requested;
  if (!selected || selected.moduleId === 'digico-osc') return;
  throw new CommandParseError(`${selected.name} is selected, but its CCB command adapter still needs implementation.`, {
    code: 'MODULE_ADAPTER_PENDING', moduleId: selected.moduleId, aiEligible: false,
  });
}

function midiInteger(text, pattern, name, min, max, fallback = null) {
  const match = text.match(pattern);
  if (!match) {
    if (fallback != null) return fallback;
    throw new CommandParseError(`${name} is required.`);
  }
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value < min || value > max) throw new CommandParseError(`${name} must be from ${min} through ${max}.`);
  return value;
}

function readMidiAction(text) {
  if (/\b(?:machine[ -]?control|MMC)\b/i.test(text)) throw new CommandParseError('Generic MIDI 1.4.0 does not expose MIDI Machine Control actions.', { aiEligible: false });
  if (/\bMIDI\s+Time\s+Code|\bMTC\b/i.test(text)) throw new CommandParseError('Generic MIDI 1.4.0 supports MIDI Time Code as receive-only.', { aiEligible: false });
  if (/\bSysEx\b/i.test(text)) {
    const payload = text.match(/\b(?:message|sysex)\s+((?:(?:(?:0x)?[0-9a-f]{2}|\d{1,3})[ ,]*){2,})/i)?.[1];
    if (!payload) throw new CommandParseError('A SysEx byte sequence is required.');
    const bytes = payload.trim().split(/[ ,]+/).filter(Boolean).map((byte) => /^0x|[a-f]/i.test(byte) ? Number.parseInt(byte.replace(/^0x/i, ''), 16) : Number(byte));
    if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new CommandParseError('Every SysEx byte must be from 0 through 255.');
    if (bytes[0] !== 0xf0 || bytes.at(-1) !== 0xf7) throw new CommandParseError('SysEx must start with F0 and end with F7.');
    return { family: 'midi', operation: 'sysex', bytes: bytes.map((byte) => `0x${byte.toString(16).padStart(2, '0')}`).join(' ') };
  }
  const channel = midiInteger(text, /\b(?:channel|ch)\s*#?\s*(\d+)\b/i, 'MIDI channel', 1, 16, 1);
  const ccMatches = [...text.matchAll(/\b(?:MIDI\s+)?CC\s*#?\s*(\d+)(?:\s*(?:value|to)\s*(\d+))?/gi)];
  const momentaryCc = ccMatches.length && (/\bmomentary\b|\bon\s*\/\s*off\b|\bon\s+(?:press|pressed|release|released)\b|\bwhen\s+(?:pressed|released)\b/i.test(text));
  if (momentaryCc) {
    const press = ccMatches[0];
    const release = ccMatches.length > 1 ? ccMatches.at(-1) : press;
    const controller = (match, name) => {
      const value = Number(match[1]);
      if (!Number.isInteger(value) || value < 0 || value > 127) throw new CommandParseError(`${name} must be from 0 through 127.`);
      return value;
    };
    const midiValue = (match, fallback, name) => {
      if (match[2] == null) return fallback;
      const value = Number(match[2]);
      if (!Number.isInteger(value) || value < 0 || value > 127) throw new CommandParseError(`${name} must be from 0 through 127.`);
      return value;
    };
    return {
      family: 'midi', operation: 'momentary-cc', channel,
      press: { controller: controller(press, 'Press MIDI controller'), value: midiValue(press, 127, 'Press MIDI value') },
      release: { controller: controller(release, 'Release MIDI controller'), value: midiValue(release, 0, 'Release MIDI value') },
    };
  }
  if (/\b(?:control(?:ler)? change|CC)\b/i.test(text)) return {
    family: 'midi', operation: 'cc', channel,
    controller: midiInteger(text, /\b(?:control(?:ler)? change|CC)\s*#?\s*(\d+)\b/i, 'MIDI controller', 0, 127),
    value: midiInteger(text, /\b(?:value|to)\s+(\d+)\b/i, 'MIDI value', 0, 127),
  };
  if (/\b(?:program(?: change)?|patch)\b/i.test(text)) return {
    family: 'midi', operation: 'program', channel,
    program: midiInteger(text, /\b(?:program(?: change)?|patch)\s*#?\s*(\d+)\b/i, 'MIDI program', 1, 128),
  };
  if (/\bpitch (?:wheel|bend)\b/i.test(text)) return {
    family: 'midi', operation: 'pitch', channel,
    value: /\b(?:full[ -]?scale|maximum|max)\b/i.test(text) ? 16383 : /\b(?:center|centre)\b/i.test(text) ? 8192 : /\bminimum|min\b/i.test(text) ? 0 : midiInteger(text, /\b(?:value|to)\s+(\d+)\b/i, 'Pitch-wheel value', 0, 16383),
  };
  if (/\bnote\b/i.test(text)) {
    if (/\bmomentary\b|\bwhen (?:pressed|released)\b/i.test(text)) throw new CommandParseError('Momentary press/release MIDI buttons need release-action support and are not enabled yet.', { aiEligible: false });
    const operation = /\bnote off\b/i.test(text) ? 'noteoff' : 'noteon';
    return {
      family: 'midi', operation, channel,
      note: midiInteger(text, /\bnote(?:\s+(?:on|off))?\s+(\d+)\b/i, 'MIDI note', 0, 127),
      velocity: midiInteger(text, /\bvelocity\s+(\d+)\b/i, 'MIDI velocity', 0, 127, operation === 'noteon' ? 127 : 0),
    };
  }
  throw new CommandParseError('Specify MIDI Note On/Off, Control Change, Program Change, Pitch Wheel, or SysEx.');
}

function parseMidiCommand(text, defaultPage) {
  const { location, actionText } = readLocation(text, defaultPage);
  const action = readMidiAction(actionText);
  const appearance = readAppearance(text);
  const defaultLabel = action.operation === 'noteon' || action.operation === 'noteoff' ? `MIDI ${action.operation === 'noteon' ? 'ON' : 'OFF'}\nNOTE ${action.note}`
    : action.operation === 'momentary-cc' ? `MIDI CC ${action.press.controller}\nMOMENTARY`
    : action.operation === 'cc' ? `MIDI CC ${action.controller}\n${action.value}`
      : action.operation === 'program' ? `MIDI PROGRAM\n${action.program}`
        : action.operation === 'pitch' ? `MIDI PITCH\n${action.value}` : 'MIDI\nSYSEX';
  return { kind: 'create-button', location, action, appearance: { label: appearance.label || defaultLabel, ...appearance }, moduleId: 'generic-midi', sourceText: text.trim() };
}

function readFaderAction(text) {
  const off = /\bfader\s+off\b/i.test(text) || /\bturns?\b.{0,70}\bfader\b.{0,40}\boff\b/i.test(text);
  const levelMatch = text.match(/\b(?:to|at)\s*([+-]?\d+)\s*dB\b/i);
  if (!off && !levelMatch) throw new CommandParseError('A supported fader level or OFF is required.');
  const levelDb = off ? 'OFF' : Number(levelMatch[1]);
  if (levelDb !== 'OFF' && !FADER_LEVELS.has(levelDb)) {
    throw new CommandParseError(`Fader level ${levelDb} dB is not offered by digico_osc 1.0.4.`);
  }
  const targetText = text.replace(/\s+(?:to|at)\s*[+-]?\d+\s*dB\b.*$/i, '');
  const channels = readChannels(targetText);
  return { family: 'channel-fader', operation: 'set-fader', channels, levelDb };
}

export function parseCommand(text, { defaultPage = 1, targetModuleId = '' } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new CommandParseError('Command cannot be empty.');
  const namedModule = EXPLICIT_MODULES.find((module) => module.pattern.test(text))?.moduleId || '';
  if ((targetModuleId || namedModule) === 'generic-midi') {
    if (targetModuleId && namedModule && targetModuleId !== namedModule) guardExplicitModuleRouting(text, targetModuleId);
    return parseMidiCommand(text, defaultPage);
  }
  guardExplicitModuleRouting(text, targetModuleId);
  rejectUnsupportedCapabilities(text);

  const { location, actionText } = readLocation(text, defaultPage);
  const appearance = readAppearance(text);
  const isFader = /\b(?:fader|dB)\b/i.test(actionText);
  const isSnapshot = /\bsnapshots?\b/i.test(actionText);
  const isMacro = /\b(?:DiGiCo\s+)?macros?\b/i.test(actionText);
  const isAux = /\baux(?:es)?\b/i.test(actionText);
  const isControlGroup = /\b(?:control groups?|CGs?)\b/i.test(actionText);
  const isInsert = /\binsert\s*[ab]\b/i.test(actionText);
  const action = isInsert ? readInsertAction(actionText) : isMacro ? readMacroAction(actionText) : isSnapshot ? readSnapshotAction(actionText) : isFader ? readFaderAction(actionText) : isAux ? {
    family: 'aux-mute', operation: readOperation(actionText), auxes: readAuxes(actionText),
  } : isControlGroup ? {
    family: 'control-group-mute', operation: readOperation(actionText), controlGroups: readControlGroups(actionText),
  } : (() => {
    const channels = readChannels(actionText);
    return channels.length === 1
      ? { family: 'channel-mute', operation: readOperation(actionText), channel: channels[0] }
      : { family: 'channel-mute', operation: readOperation(actionText), channels };
  })();
  return {
    kind: 'create-button',
    location,
    action,
    ...(Object.keys(appearance).length ? { appearance } : {}),
    sourceText: text.trim(),
  };
}
