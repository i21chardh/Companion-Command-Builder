const COLORS = Object.freeze({
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ff8c00', gray: '#808080', grey: '#808080', purple: '#800080',
});

const NUMBER_WORD_VALUES = Object.freeze({ zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 });
const NUMBER_TOKEN = '(?:\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
const LOCATION = new RegExp(`(?:^|[\\s,;:(])(?<page>${NUMBER_TOKEN})\\s*(?:/|\\.|\\bdot\\b)\\s*(?<row>${NUMBER_TOKEN})\\s*(?:/|\\.|\\bdot\\b)\\s*(?<column>${NUMBER_TOKEN})(?=$|[\\s,;).])`, 'i');
const COLOR = '(black|white|red|green|blue|yellow|orange|gr[ae]y|purple)';

function locationNumber(value) {
  const normalized = String(value).toLowerCase();
  return /^\d+$/.test(normalized) ? Number(normalized) : NUMBER_WORD_VALUES[normalized];
}

function normalizeEditText(text) {
  const value = String(text || '').trim();
  const wrapped = value.match(/^["“'‘]([\s\S]*)["”'’]$/);
  return (wrapped ? wrapped[1] : value).trim();
}

export function isEditCommand(text) {
  return /^(?:(?:can|could|would)\s+(?:you|we)\s+|please\s+)?(?:change|update|edit|rename|set)\b/i.test(normalizeEditText(text));
}

export function parseEditCommand(text) {
  const source = normalizeEditText(text);
  if (!isEditCommand(source)) throw new Error('An edit command must begin with change, update, edit, rename, or set.');
  const locationMatch = source.match(LOCATION);
  if (!locationMatch) throw new Error('An existing button location is required in PAGE/ROW/COLUMN or PAGE.ROW.COLUMN format.');
  const location = {
    page: locationNumber(locationMatch.groups.page),
    row: locationNumber(locationMatch.groups.row),
    column: locationNumber(locationMatch.groups.column),
  };
  if (!Number.isInteger(location.page) || location.page < 1 || !Number.isInteger(location.row) || location.row < 0 || !Number.isInteger(location.column) || location.column < 0) throw new Error('Page must be positive; Companion row and column may begin at zero.');

  const changes = {};
  const directiveText = source.replace(/["“][^"”]*["”]/g, '');
  const visualToggle = /\btoggle\s+(?:the\s+)?colors?\b|\bcolors?\s+when\s+toggling\s+state\b/i.test(directiveText);
  const toggle = !visualToggle && /\b(?:toggle|toggle button|toggle-mute)\b/i.test(directiveText);
  const invertColors = visualToggle || /\binvert(?:ed)?\s+(?:the\s+)?colors?\b|\bcolors?\s+(?:that\s+)?invert/i.test(directiveText);
  const textColor = source.match(new RegExp(`(?:font|text)(?:\\s+color)?[^.;]{0,30}?\\b(?:to|as)\\s+${COLOR}\\b`, 'i'))
    || source.match(new RegExp(`\\b${COLOR}\\s+(?:font|text)\\b`, 'i'));
  const backgroundColor = source.match(new RegExp(`(?:background|button)(?:\\s+color)?[^.;]{0,30}?\\b(?:to|as)\\s+${COLOR}\\b`, 'i'))
    || source.match(new RegExp(`\\b${COLOR}\\s+(?:background|button)\\b`, 'i'));
  const shorthandColors = source.match(new RegExp(`\\b${COLOR}\\s+(?:and|on)\\s+${COLOR}(?=\\s+(?:and\\s+)?(?:toggle|invert|colors?|when)\\b|[.,;]|$)`, 'i'));
  // Location shorthand contains periods (1.2.3), so label matching must not
  // treat punctuation inside the coordinates as the end of the edit clause.
  const label = source.match(/\b(?:label|text|name)\b[\s\S]{0,60}?\b(?:to|as)\s+["“]([^"”]+)["”]/i)
    || source.match(/\brename\b[\s\S]{0,80}?\bto\s+["“]([^"”]+)["”]/i)
    || source.match(/\brename\b[\s\S]{0,80}?\bto\s+([^,;]+?)\s*$/i);

  if (textColor || shorthandColors) changes.textColor = COLORS[(textColor?.[1] || shorthandColors[1]).toLowerCase()];
  if (backgroundColor || shorthandColors) changes.backgroundColor = COLORS[(backgroundColor?.[1] || shorthandColors[2]).toLowerCase()];
  if (label) changes.text = label[1].trim();
  if (toggle) changes.operation = 'toggle-mute';
  if (invertColors) changes.invertColors = true;
  if (visualToggle) changes.visualToggle = true;
  if (!Object.keys(changes).length) throw new Error('Specify a new label, font color, background color, or toggle behavior for the existing button.');
  return { kind: 'edit-button', location, changes, sourceText: source };
}

export function buildEditPlan(command, existing, target, module = { id: 'digico_osc', version: '1.0.4', connectionLabel: null }) {
  if (!existing) throw new Error(`No Companion button exists at ${command.location.page}/${command.location.row}/${command.location.column}.`);
  const text = command.changes.text ?? existing.text;
  const textColor = command.changes.textColor ?? existing.textColor;
  const backgroundColor = command.changes.backgroundColor ?? existing.backgroundColor;
  const descriptions = [
    command.changes.text != null ? `Change label to “${command.changes.text}”` : null,
    command.changes.textColor ? `Change font to ${command.changes.textColor}` : null,
    command.changes.backgroundColor ? `Change background to ${command.changes.backgroundColor}` : null,
    command.changes.operation === 'toggle-mute' ? 'Replace current behavior with a two-step toggle' : null,
    command.changes.invertColors ? 'Invert foreground and background colors when toggled' : null,
  ].filter(Boolean);
  if (command.changes.operation === 'toggle-mute') {
    const muteActions = (existing.programmedActions || []).filter((action) => ['mute', 'auxmute', 'cgmute'].includes(action.definitionId));
    if (!muteActions.length) throw new Error('The selected button has no readable DiGiCo mute target to convert. Include the channel, aux, or control-group number in the command.');
    const definitionId = muteActions[0].definitionId;
    const targets = [...new Set(muteActions.map((action) => Number(action.options?.channel)).filter(Number.isFinite))];
    if (!targets.length) throw new Error('The selected button’s DiGiCo target could not be read. Include the target number in the command.');
    const action = definitionId === 'auxmute'
      ? { family: 'aux-mute', operation: 'toggle-mute', auxes: targets }
      : definitionId === 'cgmute'
        ? { family: 'control-group-mute', operation: 'toggle-mute', controlGroups: targets }
        : { family: 'channel-mute', operation: 'toggle-mute', channels: targets };
    const unmuted = { textColor, backgroundColor };
    const muted = command.changes.invertColors ? { textColor: backgroundColor, backgroundColor: textColor } : { textColor, backgroundColor };
    return {
      schemaVersion: 1, kind: 'replace-button', target,
      module: { ...module },
      button: { location: { ...command.location }, text, appearance: { ...unmuted, states: { unmuted, muted } }, action },
      actions: [],
      edit: { changes: { ...command.changes }, original: { text: existing.text, textColor: existing.textColor, backgroundColor: existing.backgroundColor }, descriptions },
      sourceText: command.sourceText,
    };
  }
  if (command.changes.visualToggle) {
    const macroActions = (existing.programmedActions || []).filter((action) => action.definitionId === 'macros');
    const macros = [...new Set(macroActions.map((action) => Number(action.options?.macro)).filter(Number.isFinite))];
    if (macros.length === 1 && (existing.programmedActions || []).every((action) => action.definitionId === 'macros')) {
      const unmuted = { textColor, backgroundColor };
      const muted = { textColor: backgroundColor, backgroundColor: textColor };
      return {
        schemaVersion: 1, kind: 'replace-button', target, module: { ...module },
        button: { location: { ...command.location }, text, appearance: { ...unmuted, states: { unmuted, muted } }, action: { family: 'macro', operation: 'fire-macro', macro: macros[0] } },
        actions: [], edit: { changes: { ...command.changes }, original: { text: existing.text, textColor: existing.textColor, backgroundColor: existing.backgroundColor }, descriptions }, sourceText: command.sourceText,
      };
    }
  }
  const visualStates = command.changes.visualToggle
    ? { unmuted: { textColor, backgroundColor }, muted: { textColor: backgroundColor, backgroundColor: textColor } }
    : null;
  return {
    schemaVersion: 1,
    kind: 'edit-button',
    target,
    button: {
      location: { ...command.location }, text,
      appearance: { textColor, backgroundColor, textSize: command.changes.textSize ?? existing.textSize ?? 'auto', ...(visualStates ? { states: visualStates } : {}) },
      action: { family: 'existing', operation: 'preserve' },
    },
    actions: [{ step: '—', actionId: 'preserved', summary: 'Preserve every existing action and feedback' }],
    edit: {
      changes: { ...command.changes },
      original: { text: existing.text, textColor: existing.textColor, backgroundColor: existing.backgroundColor },
      descriptions,
    },
    sourceText: command.sourceText,
  };
}
