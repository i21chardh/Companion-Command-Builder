const COLORS = { red: '#ff0000', blue: '#0000ff', green: '#00ff00', yellow: '#ffff00', white: '#ffffff', black: '#000000', orange: '#ff8800', purple: '#8000ff' };

function metadata(command) {
  const location = String(command).match(/(?:\bat\s+|\bon\s+)?(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)/i);
  if (!location) return null;
  const label = String(command).match(/(?:label(?:ed)?|called|named)\s+["“']([^"”']+)["”']/i)?.[1] || '';
  const color = String(command).match(/\b(red|blue|green|yellow|white|black|orange|purple)\s+(?:button|background)\b/i)?.[1]?.toLowerCase();
  const font = String(command).match(/\b(red|blue|green|yellow|white|black|orange|purple)\s+(?:font|text)\b/i)?.[1]?.toLowerCase();
  return { page: Number(location[1]), row: Number(location[2]), column: Number(location[3]), label, textColor: COLORS[font] || '#ffffff', backgroundColor: COLORS[color] || '#000000', note: 'Mapped by CCB deterministic module parser.' };
}

function has(adapter, id) { return adapter.actions.some((item) => item.id === id); }

export function interpretKnownDynamicCommand(command, adapter) {
  const meta = metadata(command);
  if (!meta) return null;
  const text = String(command);
  let actionId = '';
  let options = {};
  if (adapter.moduleId === 'obs-studio') {
    if (/\b(?:toggle|toggles|start\/?stop)\s+(?:the\s+)?stream(?:ing)?\b/i.test(text)) actionId = 'StartStopStreaming';
    else if (/\bstart\s+(?:the\s+)?stream(?:ing)?\b/i.test(text)) actionId = 'start_streaming';
    else if (/\bstop\s+(?:the\s+)?stream(?:ing)?\b/i.test(text)) actionId = 'stop_streaming';
    else if (/\b(?:toggle|toggles|start\/?stop)\s+(?:the\s+)?record(?:ing)?\b/i.test(text)) actionId = 'StartStopRecording';
    else if (/\bstart\s+(?:the\s+)?record(?:ing)?\b/i.test(text)) actionId = 'start_recording';
    else if (/\bstop\s+(?:the\s+)?record(?:ing)?\b/i.test(text)) actionId = 'stop_recording';
    else if (/\bsave\s+(?:the\s+)?replay\s+buffer\b/i.test(text)) actionId = 'save_replay_buffer';
    else if (/\btoggle\s+(?:the\s+)?replay\s+buffer\b/i.test(text)) actionId = 'ToggleReplayBuffer';
    else if (/\b(?:program\s+scene|put\s+.+?\s+live|change(?:s)?\s+(?:the\s+)?program\s+scene)\b/i.test(text)) {
      actionId = 'set_scene';
      const scene = text.match(/(?:program\s+scene\s+(?:to\s+)?|put\s+)([a-z0-9 _-]+?)(?:\s+live|[.;]|$)/i)?.[1]?.trim();
      if (!scene) return null;
      options = { scene: 'customSceneName', customSceneName: scene };
    } else if (/\btoggle\s+mute\b|\bmute\s+toggle\b/i.test(text)) {
      actionId = 'toggle_source_mute';
      const source = text.match(/(?:source\s+(?:named\s+)?|for\s+(?:the\s+)?)([a-z0-9 _-]+?)(?:\s+source|\s+at\s+\d|[.;]|$)/i)?.[1]?.trim();
      if (!source) return null;
      options = { source };
    }
  } else if (adapter.moduleId === 'figure53-qlab-advance') {
    if (/\b(?:go|fire|fires|trigger|triggers)\s+(?:the\s+)?next\s+cue\b|\bqlab\s+go\b/i.test(text)) actionId = 'go';
    else if (/\bpanic\b|\bstops?\s+all(?:\s+(?:running\s+)?cues?)?\b/i.test(text)) actionId = 'panic';
    else if (/\btoggle\s+pause\b|\bpause\s+toggle\b/i.test(text)) actionId = 'togglePause';
    else if (/\bpause\b/i.test(text)) actionId = 'pause';
    else if (/\bresume\b/i.test(text)) actionId = 'resume';
    else if (/\bstop\b/i.test(text)) actionId = 'stop';
  } else if (adapter.moduleId === 'cockos-reaper') {
    if (/\b(?:start\s+)?play(?:back)?\b/i.test(text)) actionId = 'play';
    else if (/\bstop(?:\s+playback)?\b/i.test(text)) actionId = 'stop';
    else if (/\b(?:start\s+)?record(?:ing)?\b/i.test(text)) actionId = 'record';
    else if (/\bpause\b/i.test(text)) actionId = 'pause';
  } else if (adapter.moduleId === 'shure-wireless') {
    const channel = text.match(/\b(?:receiver\s+)?channel\s*#?\s*(\d+)\b/i)?.[1] || '1';
    const slot = text.match(/\bslot\s*#?\s*(\d+)\b/i)?.[1];
    const displayMetric = /\b(?:show|display|readout)\b/i.test(text)
      ? (/\bgain\b/i.test(text) ? 'gain' : /\bfrequenc(?:y|ies)\b/i.test(text) ? 'frequency' : '')
      : '';
    if (displayMetric) {
      return {
        recognized: true, displayVariable: displayMetric === 'gain' ? `ch_${channel}_audio_gain` : `ch_${channel}_frequency`,
        displayMetric, channel: Number(channel), ...meta, sourceText: text,
      };
    } else if (/\b(?:rf|radio\s*frequency)\s+power(?:\s+level)?\b/i.test(text) && slot) {
      actionId = 'slot_rf_power';
      const power = /\blow\b/i.test(text) ? 'LOW' : /\bhigh\b/i.test(text) ? 'HIGH' : 'NORMAL';
      options = { slot: `${channel}:${slot}`, power };
    } else if (/\b(?:rf|radio\s*frequency)\s+(?:output|mute|on)\b/i.test(text) && slot) {
      actionId = 'slot_rf_output';
      options = { slot: `${channel}:${slot}`, onoff: /\b(?:mute|off)\b/i.test(text) ? 'RF_MUTE' : 'RF_ON' };
    } else if (/\bflash\b/i.test(text)) {
      actionId = /\bchannel\s*#?\s*\d+\b/i.test(text) ? 'flash_channel' : 'flash_lights';
      options = actionId === 'flash_channel' ? { channel } : {};
    } else if (/\b(?:toggle|mute|unmute)\b/i.test(text) && /\bchannel\s*#?\s*\d+\b/i.test(text)) {
      actionId = 'channel_mute';
      options = { channel, choice: /\bunmute\b/i.test(text) ? 'OFF' : /\btoggle\b/i.test(text) ? 'TOGGLE' : 'ON' };
    }
  }
  if (!actionId || !has(adapter, actionId)) return null;
  return { recognized: true, actionId, options, optionsJson: JSON.stringify(options), ...meta, sourceText: text };
}
