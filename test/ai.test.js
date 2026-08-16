import test from 'node:test';
import assert from 'node:assert/strict';
import { aiStatus, bridgeCommand, interactiveAiTimeoutMs, interpretDynamicModuleCommand } from '../src/ai.js';

test('AI defaults to local Ollama and qwen3:4b', () => {
  assert.deepEqual(aiStatus(), {
    enabled: true,
    provider: 'ollama',
    model: 'qwen3:4b',
    endpoint: 'http://127.0.0.1:11434',
  });
});

test('interactive AI failures return within the short retry window', () => {
  const previous = process.env.CCB_AI_INTERACTIVE_TIMEOUT_MS;
  try {
    delete process.env.CCB_AI_INTERACTIVE_TIMEOUT_MS;
    assert.equal(interactiveAiTimeoutMs(), 6000);
    process.env.CCB_AI_INTERACTIVE_TIMEOUT_MS = '99999';
    assert.equal(interactiveAiTimeoutMs(), 15000);
  } finally {
    if (previous == null) delete process.env.CCB_AI_INTERACTIVE_TIMEOUT_MS;
    else process.env.CCB_AI_INTERACTIVE_TIMEOUT_MS = previous;
  }
});

test('dynamic interpreter tells Ollama that CCB owns button creation and placement', async (context) => {
  const previousFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = previousFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ recognized: true, actionId: 'StartStopStreaming', optionsJson: '{}', page: 1, row: 1, column: 1, label: 'LIVE', textColor: '#ffffff', backgroundColor: '#ff0000', note: 'mapped behavior' }) } }), { status: 200 });
  };
  const result = await interpretDynamicModuleCommand('Create an OBS button at 1/1/1 to toggle streaming', { name: 'OBS Studio', actions: [{ id: 'StartStopStreaming', name: 'Toggle Streaming', options: [] }] });
  assert.equal(result.actionId, 'StartStopStreaming');
  assert.match(request.messages[0].content, /CCB—not the module—creates the button/);
  assert.match(request.messages[0].content, /not because the module schema lacks a create-button action/);
});

test('bridge sends a schema-constrained local request', async (context) => {
  const previousFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = previousFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ message: { content: JSON.stringify({ recognized: true, canonicalCommand: 'toggle mute channels 1 and 3 at 1/2/3', note: 'normalized' }) } }), { status: 200 });
  };

  const result = await bridgeCommand('kill one and three at 1/2/3', new Error('not parsed'));
  assert.equal(request.url, 'http://127.0.0.1:11434/api/chat');
  assert.equal(request.body.model, 'qwen3:4b');
  assert.equal(request.body.format.additionalProperties, false);
  assert.equal(result.provider, 'ollama');
  assert.equal(result.canonicalCommand, 'toggle mute channels 1 and 3 at 1/2/3');
});
