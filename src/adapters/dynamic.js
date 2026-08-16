function simplifyOption(option = {}) {
  return {
    id: String(option.id || ''), type: option.type || 'textinput', label: option.label || option.id || '',
    default: option.default, required: option.required === true, min: option.min, max: option.max,
    choices: Array.isArray(option.choices) ? option.choices.map((choice) => ({ id: choice.id, label: choice.label })) : [],
  };
}

export function compileDynamicAdapter(module, liveSchema) {
  const actions = Object.entries(liveSchema?.actions || {}).map(([id, definition]) => ({
    id, name: definition.name || id, description: definition.description || definition.descriptionShort || '',
    options: Array.isArray(definition.options) ? definition.options.filter((option) => option?.id && option.type !== 'static-text').map(simplifyOption) : [],
  }));
  if (!actions.length) throw new Error('No live Companion actions were available to compile.');
  return {
    format: 'ccb-dynamic-adapter', schemaVersion: 1, moduleId: module.moduleId, version: module.version,
    name: module.name, compiledAt: new Date().toISOString(), actions,
    feedbackCount: Object.keys(liveSchema?.feedbacks || {}).length,
  };
}

function coerce(option, value) {
  if (value == null || value === '') return option.default;
  if (option.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${option.label} must be a number.`);
    if (option.min != null && number < option.min) throw new Error(`${option.label} must be at least ${option.min}.`);
    if (option.max != null && number > option.max) throw new Error(`${option.label} must be no more than ${option.max}.`);
    return number;
  }
  if (option.type === 'checkbox') return value === true || value === 'true' || value === 1 || value === '1';
  if (option.type === 'dropdown' && option.choices.length && !option.choices.some((choice) => String(choice.id) === String(value))) throw new Error(`${option.label} is not an available choice.`);
  return value;
}

export function validateDynamicAction(adapter, selection) {
  const action = adapter.actions.find((item) => item.id === selection.actionId);
  if (!action) throw new Error(`Action “${selection.actionId}” is not in the live ${adapter.name} schema.`);
  const supplied = selection.options && typeof selection.options === 'object' ? selection.options : {};
  const allowed = new Set(action.options.map((option) => option.id));
  for (const key of Object.keys(supplied)) if (!allowed.has(key)) throw new Error(`Option “${key}” is not valid for ${action.name}.`);
  const options = {};
  for (const option of action.options) {
    const value = coerce(option, supplied[option.id]);
    if (value == null && option.required) throw new Error(`${option.label} is required.`);
    if (value != null) options[option.id] = value;
  }
  return { definitionId: action.id, name: action.name, options };
}

export function buildDynamicPlan(adapter, interpretation, target) {
  if (interpretation?.displayVariable && adapter.moduleId === 'shure-wireless') {
    const metric = interpretation.displayMetric === 'frequency' ? 'frequency' : 'gain';
    const channel = Number(interpretation.channel || 1);
    return {
      kind: 'create-button', schemaVersion: 1, target,
      module: { id: adapter.moduleId, version: adapter.version, name: adapter.name, dynamic: true },
      safety: { overwriteExisting: false, requireConfirmation: true },
      button: {
        location: { page: interpretation.page, row: interpretation.row, column: interpretation.column },
        text: interpretation.label || `CH ${channel}\n${metric === 'gain' ? 'GAIN' : 'FREQ'}`,
        appearance: { textColor: interpretation.textColor || '#ffffff', backgroundColor: interpretation.backgroundColor || '#000000' },
        action: { family: 'variable-display', operation: `show-${metric}`, channel, variableId: interpretation.displayVariable, prefix: metric === 'gain' ? 'GAIN' : 'FREQ' },
        feedback: null, stateFeedback: null,
      },
      deployment: { status: 'candidate', reason: 'Uses the installed Shure Wireless live channel variable; operator confirmation required.' },
      sourceText: interpretation.sourceText || '', dynamic: { compiledAt: adapter.compiledAt },
    };
  }
  const definition = validateDynamicAction(adapter, interpretation);
  return {
    kind: 'create-button', schemaVersion: 1, target,
    module: { id: adapter.moduleId, version: adapter.version, name: adapter.name, dynamic: true },
    safety: { overwriteExisting: false, requireConfirmation: true },
    button: {
      location: { page: interpretation.page, row: interpretation.row, column: interpretation.column },
      text: interpretation.label || definition.name,
      appearance: { textColor: interpretation.textColor || '#ffffff', backgroundColor: interpretation.backgroundColor || '#000000' },
      action: { family: 'dynamic', operation: definition.definitionId, definitions: [definition] }, feedback: null, stateFeedback: null,
    },
    deployment: { status: 'candidate', reason: adapter.provisional ? 'Validated against the installed module version baseline; live connection validation remains pending.' : 'Validated against the captured live Companion action schema; operator confirmation required.' },
    sourceText: interpretation.sourceText || '', dynamic: { compiledAt: adapter.compiledAt },
  };
}

export function validateDynamicPlanAvailability(plan, liveSchema, connection = {}) {
  if (plan?.button?.action?.family !== 'dynamic') return true;
  const available = new Set(Object.keys(liveSchema?.actions || liveSchema || {}));
  const requested = (plan.button.action.definitions || []).map((definition) => definition.definitionId);
  const missing = requested.filter((id) => !available.has(id));
  if (!missing.length) return true;
  const moduleId = plan.module?.id || 'selected module';
  const label = connection.label ? ` “${connection.label}”` : '';
  const axientHint = moduleId === 'shure-wireless' && missing.some((id) => /^slot_rf_/.test(id))
    ? ' Edit the Shure connection and choose the actual Axient AD4D or AD4Q receiver model; ULX-D connections do not expose slot RF actions.'
    : ' Edit the connection configuration or rerun CCB support configuration after the required action becomes available.';
  throw new Error(`${moduleId} connection${label} does not expose action ${missing.map((id) => `“${id}”`).join(', ')}.${axientHint}`);
}
