import assert from 'node:assert/strict';
import { splitBatchCommands, duplicateLocations } from '../src/batch.js';
import { resolveBatchModule } from '../src/module-routing.js';
import { provisionalAdapter } from '../src/adapters/provisional.js';
import { interpretKnownDynamicCommand } from '../src/deterministic-dynamic.js';
import { buildDynamicPlan } from '../src/adapters/dynamic.js';
import { parseCommand } from '../src/parser.js';
import { buildDeploymentPlan } from '../src/plan.js';
import { defaultConfig } from '../src/config.js';

export const GENERATOR_BATCHES = [
  {
    id: 'obs-core', selected: 'cockos-reaper', moduleId: 'obs-studio',
    prompt: 'Create three OBS buttons: at 1/1/1 create a red button labeled "LIVE" that toggles streaming; at 1/1/2 create a button labeled "REC" that toggles recording; at 1/1/3 create a blue button labeled "CAM 2" that changes the program scene to Camera 2.',
    actions: ['StartStopStreaming', 'StartStopRecording', 'set_scene'],
  },
  {
    id: 'obs-replay-audio', selected: '', moduleId: 'obs-studio',
    prompt: 'Create three OBS controls: save the replay buffer at 1/2/1 labeled "SAVE"; toggle the replay buffer at 1/2/2 labeled "REPLAY"; toggle mute for the Host Mic source at 1/2/3 labeled "MIC".',
    actions: ['save_replay_buffer', 'ToggleReplayBuffer', 'toggle_source_mute'],
  },
  {
    id: 'qlab-show', selected: 'obs-studio', moduleId: 'figure53-qlab-advance',
    prompt: 'Create three QLab buttons on layer/page 2: put a green "GO" button at 2/1/1 that fires the next cue; put a yellow "PAUSE 12" button at 2/1/2 that pauses cue 12; and put a red "PANIC" button at 2/1/3 that stops all running cues.',
    actions: ['go', 'pause', 'panic'],
  },
  {
    id: 'qlab-safety', selected: '', moduleId: 'figure53-qlab-advance',
    prompt: 'Create three QLab buttons: stop all cues at 2/2/1 labeled "PANIC"; stop at 2/2/2 labeled "STOP"; toggle pause at 2/2/3 labeled "HOLD".',
    actions: ['panic', 'stop', 'togglePause'],
  },
  {
    id: 'digico-monitor', selected: 'obs-studio', moduleId: 'digico-osc',
    prompt: 'Create three DiGiCo buttons: toggle mute channels 1, 3, 7 and 11 at 3/1/1 labeled "TB"; fire snapshot 5 at 3/1/2 labeled "SNAP 5"; fire macro 12 at 3/1/3 labeled "WAVES".',
    operations: ['toggle-mute', 'fire-snapshot', 'fire-macro'],
  },
];

export function auditGeneratorBatches() {
  const results = [];
  for (const batch of GENERATOR_BATCHES) {
    const moduleId = resolveBatchModule(batch.prompt, batch.selected);
    assert.equal(moduleId, batch.moduleId, `${batch.id}: routing`);
    const commands = splitBatchCommands(batch.prompt);
    assert.equal(commands.length, 3, `${batch.id}: expected three commands`);
    let plans;
    if (moduleId === 'obs-studio' || moduleId === 'figure53-qlab-advance') {
      const adapter = provisionalAdapter(moduleId);
      plans = commands.map((command) => {
        const interpretation = interpretKnownDynamicCommand(command, adapter);
        assert.ok(interpretation, `${batch.id}: deterministic interpretation failed for ${command}`);
        return buildDynamicPlan(adapter, interpretation, { product: 'Bitfocus Companion' });
      });
      assert.deepEqual(plans.map((plan) => plan.button.action.operation), batch.actions, `${batch.id}: actions`);
    } else {
      plans = commands.map((command) => buildDeploymentPlan(parseCommand(command, { targetModuleId: moduleId }), defaultConfig));
      assert.deepEqual(plans.map((plan) => plan.button.action.operation), batch.operations, `${batch.id}: operations`);
    }
    assert.deepEqual(duplicateLocations(plans), [], `${batch.id}: duplicate positions`);
    results.push({ id: batch.id, moduleId, commands: commands.length, status: 'pass' });
  }
  return results;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const results = auditGeneratorBatches();
  console.log(JSON.stringify({ passed: results.length, buttons: results.reduce((sum, item) => sum + item.commands, 0), results }, null, 2));
}
