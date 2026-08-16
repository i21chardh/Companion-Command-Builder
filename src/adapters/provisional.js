const option = (id, label, type = 'textinput', extra = {}) => ({ id, label, type, choices: [], required: false, ...extra });
const action = (id, name, options = [], description = '') => ({ id, name, description, options });

const adapters = {
  'obs-studio': {
    format: 'ccb-dynamic-adapter', schemaVersion: 1, provisional: true, moduleId: 'obs-studio', version: '3.15.3', name: 'OBS Studio',
    actions: [
      action('StartStopStreaming', 'Toggle Streaming'), action('start_streaming', 'Start Streaming'), action('stop_streaming', 'Stop Streaming'),
      action('StartStopRecording', 'Toggle Recording'), action('start_recording', 'Start Recording'), action('stop_recording', 'Stop Recording'),
      action('save_replay_buffer', 'Save Replay Buffer'), action('ToggleReplayBuffer', 'Toggle Replay Buffer'),
      action('set_scene', 'Set Program Scene', [option('scene', 'Scene', 'dropdown', { default: 'customSceneName' }), option('customSceneName', 'Custom Scene Name', 'textinput', { default: '' })]),
      action('preview_scene', 'Set Preview Scene', [option('scene', 'Scene', 'dropdown', { default: 'customSceneName' }), option('customSceneName', 'Custom Scene Name', 'textinput', { default: '' })]),
      action('toggle_source_mute', 'Toggle Source Mute', [option('source', 'Source', 'textinput', { required: true })]),
      action('set_source_mute', 'Set Source Mute', [option('source', 'Source', 'textinput', { required: true }), option('mute', 'Mute', 'dropdown', { default: 'true', choices: [{ id: 'false', label: 'False' }, { id: 'true', label: 'True' }] })]),
    ],
  },
  'figure53-qlab-advance': {
    format: 'ccb-dynamic-adapter', schemaVersion: 1, provisional: true, moduleId: 'figure53-qlab-advance', version: '2.14.1', name: 'QLab',
    actions: [
      action('go', 'Go'), action('stop', 'Stop'), action('pause', 'Pause'), action('resume', 'Resume'), action('togglePause', 'Toggle Pause'), action('panic', 'Panic All'),
      action('goto', 'Go To Cue', [option('cue', 'Cue', 'textinput', { required: true })]),
      action('start', 'Start Cue', [option('cue', 'Cue', 'textinput', { required: true })]),
      action('stop_cue', 'Stop Cue', [option('cue', 'Cue', 'textinput', { required: true })]),
      action('panic_cue', 'Panic Cue', [option('cue', 'Cue', 'textinput', { required: true })]),
    ],
  },
  'cockos-reaper': {
    format: 'ccb-dynamic-adapter', schemaVersion: 1, provisional: true, moduleId: 'cockos-reaper', version: '2.5.0', name: 'Cockos: REAPER',
    actions: [
      action('play', 'Play'), action('stop', 'Stop'), action('record', 'Record'), action('pause', 'Pause'),
    ],
  },
  'shure-wireless': {
    format: 'ccb-dynamic-adapter', schemaVersion: 1, provisional: true, moduleId: 'shure-wireless', version: '2.3.1', name: 'Shure Wireless / Axient Digital',
    actions: [
      action('set_channel_name', 'Set channel name', [option('channel', 'Channel', 'textinput', { default: '1' }), option('name', 'Name', 'textinput', { default: '' })]),
      action('channel_mute', 'Mute or unmute channel', [option('channel', 'Channel', 'textinput', { default: '1' }), option('choice', 'Mute/Unmute/Toggle', 'dropdown', { default: 'ON', choices: [{ id: 'ON', label: 'Mute' }, { id: 'OFF', label: 'Unmute' }, { id: 'TOGGLE', label: 'Toggle Mute/Unmute' }] })]),
      action('channel_setaudiogain', 'Set audio gain of channel', [option('channel', 'Channel', 'textinput', { default: '1' }), option('gain', 'Gain Value (dB)', 'textinput', { default: '0' })]),
      action('channel_increasegain', 'Increase audio gain of channel', [option('channel', 'Channel', 'textinput', { default: '1' }), option('gain', 'Gain Value (dB)', 'textinput', { default: '3' })]),
      action('channel_decreasegain', 'Decrease audio gain of channel', [option('channel', 'Channel', 'textinput', { default: '1' }), option('gain', 'Gain Value (dB)', 'textinput', { default: '3' })]),
      action('channel_frequency', 'Set frequency of channel', [option('channel', 'Channel', 'textinput', { default: '1' }), option('value', 'Frequency (MHz)', 'textinput', { default: '470.000' })]),
      action('flash_lights', 'Flash lights on receiver'),
      action('flash_channel', 'Flash lights on receiver channel', [option('channel', 'Channel', 'textinput', { default: '1' })]),
      action('slot_rf_output', 'Set slot RF output (ADX)', [option('slot', 'Slot Number', 'textinput', { default: '1:1' }), option('onoff', 'On/Off', 'dropdown', { default: 'RF_ON', choices: [{ id: 'RF_ON', label: 'RF On' }, { id: 'RF_MUTE', label: 'RF Mute' }] })]),
      action('slot_rf_power', 'Set slot RF power level (ADX)', [option('slot', 'Slot Number', 'textinput', { default: '1:1' }), option('power', 'Power Level', 'dropdown', { default: 'NORMAL', choices: [{ id: 'LOW', label: 'Low' }, { id: 'NORMAL', label: 'Normal' }, { id: 'HIGH', label: 'High' }] })]),
    ],
  },
};

export function provisionalAdapter(moduleId) {
  return adapters[moduleId] ? structuredClone(adapters[moduleId]) : null;
}
