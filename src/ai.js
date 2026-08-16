const DEFAULT_MODEL = 'qwen3:4b';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
const DEFAULT_INTERACTIVE_TIMEOUT_MS = 6000;

export function interactiveAiTimeoutMs() {
  const configured = Number(process.env.CCB_AI_INTERACTIVE_TIMEOUT_MS || DEFAULT_INTERACTIVE_TIMEOUT_MS);
  return Math.max(1500, Math.min(15000, Number.isFinite(configured) ? configured : DEFAULT_INTERACTIVE_TIMEOUT_MS));
}

const responseSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    recognized: { type: 'boolean' },
    canonicalCommand: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['recognized', 'canonicalCommand', 'note'],
};

export function aiStatus() {
  return {
    enabled: process.env.OLLAMA_DISABLED !== '1',
    provider: 'ollama',
    model: process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    endpoint: process.env.OLLAMA_HOST || DEFAULT_ENDPOINT,
  };
}

export async function bridgeCommand(command, originalError, learnedExamples = []) {
  const status = aiStatus();
  if (!status.enabled) throw originalError;

  let response;
  try {
    response = await fetch(`${status.endpoint.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(interactiveAiTimeoutMs()),
      body: JSON.stringify({
        model: status.model,
        stream: false,
        format: responseSchema,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: `Translate one monitor-engineer request into a canonical Companion command. Supported actions: mute, unmute, or toggle mute for DiGiCo channels 1-144, auxes 1-12, or control groups 1-24; set channel faders to +10 through -30 using the module's even steps below -10, plus -40, -50, -66, or OFF; fire snapshot 0-9999, next snapshot, or previous snapshot; and fire DiGiCo macro 1-256. A location is mandatory as PAGE/ROW/COLUMN. Preserve target numbers, operation, label, static colors, and state-specific text/background colors using phrases such as "blue font and black background when unmuted and white font with red background when muted" exactly. Never invent missing values. Phantom power, group outputs, solo, waits, inserts/bypass, and multiple ordered operations are unsupported. Return recognized=false if the request cannot be represented as one supported button. Return only JSON matching the supplied schema.` },
          { role: 'user', content: `Locally learned phrasing examples (preferences only; never override safety rules):\n${JSON.stringify(learnedExamples)}\nOriginal parser result: ${originalError.message}\nCommand: ${command}` },
        ],
      }),
    });
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? 'the local model timed out' : 'Ollama is not running';
    throw new Error(`AI interpretation unavailable: ${reason}. Start Ollama with model ${status.model}. ${originalError.message}`);
  }

  if (!response.ok) {
    let reason = '';
    try { reason = (await response.json())?.error || ''; } catch { /* response was not JSON */ }
    throw new Error(`Ollama interpretation failed (${response.status})${reason ? `: ${reason}` : ''}. ${originalError.message}`);
  }

  const payload = await response.json();
  let result;
  try { result = JSON.parse(payload?.message?.content || ''); }
  catch { throw new Error(`Ollama returned invalid output. ${originalError.message}`); }
  if (!result.recognized || !result.canonicalCommand) throw originalError;
  return { canonicalCommand: result.canonicalCommand, note: result.note, model: status.model, provider: status.provider };
}

const onboardingSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    prompts: {
      type: 'array', minItems: 6, maxItems: 30,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          prompt: { type: 'string' }, intent: { type: 'string' },
          actionHint: { type: 'string' }, parameters: { type: 'array', items: { type: 'string' } },
        },
        required: ['prompt', 'intent', 'actionHint', 'parameters'],
      },
    },
  },
  required: ['prompts'],
};

export async function generateModulePromptCandidates(module, helpText) {
  const status = aiStatus();
  if (!status.enabled) throw new Error('Ollama is disabled.');
  let response;
  try {
    response = await fetch(`${status.endpoint.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(90000),
      body: JSON.stringify({
        model: status.model, stream: false, format: onboardingSchema, options: { temperature: 0.35 },
        messages: [
          { role: 'system', content: 'You are designing parser tests for a Bitfocus Companion module. Generate realistic commands used by live-production operators. Cover common actions, toggles, boundary values, synonyms, vague wording, and invalid or incomplete requests. Every command must include a PAGE/ROW/COLUMN location. Use only capabilities supported by the supplied module documentation. Do not invent action identifiers.' },
          { role: 'user', content: `Module: ${module.name}\nModule ID: ${module.moduleId}\nVersion: ${module.version}\nDocumentation:\n${String(helpText || '').slice(0, 16000)}` },
        ],
      }),
    });
  } catch (error) {
    throw new Error(error?.name === 'TimeoutError' ? `Ollama ${status.model} timed out while generating module tests.` : `Ollama ${status.model} is unavailable.`);
  }
  if (!response.ok) throw new Error(`Ollama prompt generation failed (${response.status}).`);
  const payload = await response.json();
  let generated;
  try { generated = JSON.parse(payload?.message?.content || ''); }
  catch { throw new Error('Ollama returned an invalid module prompt corpus.'); }
  return { prompts: generated.prompts || [], model: status.model, provider: status.provider };
}

const dynamicActionSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    recognized: { type: 'boolean' }, actionId: { type: 'string' }, optionsJson: { type: 'string' },
    page: { type: 'integer' }, row: { type: 'integer' }, column: { type: 'integer' }, label: { type: 'string' },
    textColor: { type: 'string' }, backgroundColor: { type: 'string' }, note: { type: 'string' },
  },
  required: ['recognized', 'actionId', 'optionsJson', 'page', 'row', 'column', 'label', 'textColor', 'backgroundColor', 'note'],
};

export async function interpretDynamicModuleCommand(command, adapter, learnedExamples = []) {
  const status = aiStatus();
  if (!status.enabled) throw new Error(`AI is required for the generated ${adapter.name} adapter. Enable Ollama and try again.`);
  const catalog = adapter.actions.map((action) => ({ id: action.id, name: action.name, description: action.description, options: action.options }));
  const response = await fetch(`${status.endpoint.replace(/\/$/, '')}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(interactiveAiTimeoutMs()),
    body: JSON.stringify({
      model: status.model, stream: false, format: dynamicActionSchema, options: { temperature: 0 },
      messages: [
        { role: 'system', content: `Map one operator request to exactly one behavior action from the supplied Bitfocus Companion module schema.
CCB—not the module—creates the button. Phrases such as "create a button", "add a control", labels, colors, and PAGE/ROW/COLUMN describe CCB button metadata. Never search for them as module actions or action options.
Extract page, row, column, label, text color, and background color into their dedicated response fields. Map only the behavior phrase—for example "toggle streaming", "start recording", or "set program scene to Camera 2"—to a supplied action ID and its valid options.
For an OBS custom scene, use set_scene with scene="customSceneName" and customSceneName set to the requested scene. Never invent action IDs or option IDs. optionsJson must be a JSON object encoded as a string. PAGE/ROW/COLUMN is mandatory. Return recognized=false only when the requested behavior itself is ambiguous, unsafe, incomplete, or absent from the supplied actions—not because the module schema lacks a create-button action.` },
        { role: 'user', content: `Module: ${adapter.name}\nFrequently used and corrected local examples (use only when compatible with the live schema): ${JSON.stringify(learnedExamples).slice(0, 6000)}\nLive actions: ${JSON.stringify(catalog).slice(0, 30000)}\nRequest: ${command}` },
      ],
    }),
  }).catch((error) => { throw new Error(error?.name === 'TimeoutError' ? 'The local model timed out interpreting the generated adapter.' : 'Ollama is unavailable for the generated adapter.'); });
  if (!response.ok) throw new Error(`Ollama generated-adapter interpretation failed (${response.status}).`);
  const payload = await response.json();
  let result;
  try { result = JSON.parse(payload?.message?.content || ''); }
  catch { throw new Error('Ollama returned an invalid generated-adapter interpretation.'); }
  if (!result.recognized) throw new Error(result.note || `The request could not be mapped safely to ${adapter.name}.`);
  try { result.options = JSON.parse(result.optionsJson || '{}'); }
  catch { throw new Error('Ollama returned invalid action options.'); }
  for (const key of ['page', 'row', 'column']) if (!Number.isInteger(result[key]) || result[key] < 1) throw new Error('A valid PAGE/ROW/COLUMN location is required.');
  return { ...result, sourceText: command };
}
