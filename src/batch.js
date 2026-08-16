export function splitBatchCommands(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\n+|;\s*/i)
    .map((item) => item.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, ''))
    .filter(Boolean);
}

const LOCATION_TOKEN = '(?:\\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
const LOCATION_PATTERN = new RegExp(`(?:^|[\\s,;:(])${LOCATION_TOKEN}\\s*(?:/|\\.|\\bdot\\b)\\s*${LOCATION_TOKEN}\\s*(?:/|\\.|\\bdot\\b)\\s*${LOCATION_TOKEN}(?=$|[\\s,;).])`, 'i');

export function commandHasLocation(text) {
  const source = String(text || '');
  return LOCATION_PATTERN.test(source)
    || /\b(?:row\s+\d+\s*(?:,|and)?\s*column\s+\d+|column\s+\d+\s*(?:,|and)?\s*row\s+\d+)\b/i.test(source);
}

export function applyDefaultLocation(text, location) {
  const source = String(text || '').trim();
  if (!source || commandHasLocation(source) || !location) return source;
  return `${source.replace(/[.\s]+$/, '')} at ${location.page}/${location.row}/${location.column}`;
}

export function expandLayoutCommand(text, moduleId = '') {
  const source = String(text || '').trim();
  if (moduleId === 'shure-wireless' && /\b(?:show|display|readout)\b/i.test(source) && /\bgain\b/i.test(source) && /\bfrequenc(?:y|ies)\b/i.test(source)) {
    const locations = [...source.matchAll(/(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)/gi)].map((match) => match.slice(1, 4).map(Number));
    if (locations.length >= 2) {
      const channel = Number(source.match(/\bchannel\s*#?\s*(\d+)\b/i)?.[1] || 1);
      return [
        `Create a Shure channel ${channel} gain display labeled "CH ${channel} GAIN" at ${locations[0].join('/')}`,
        `Create a Shure channel ${channel} frequency display labeled "CH ${channel} FREQ" at ${locations[1].join('/')}`,
      ];
    }
  }
  if (moduleId !== 'cockos-reaper' || !/\breaper\b/i.test(source) || !/\btransport controls?\b/i.test(source)) return splitBatchCommands(source);
  const range = source.match(/(?:from\s+|at\s+)?(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)\s*(?:to|through|-)\s*(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)/i);
  if (!range) {
    const anchor = source.match(/(?:from\s+|at\s+)?(\d+)\s*[/.]\s*(\d+)\s*[/.]\s*(\d+)/i);
    if (!anchor) return splitBatchCommands(source);
    const start = anchor.slice(1, 4).map(Number);
    return ['PLAY', 'STOP', 'RECORD'].map((label, index) => `Create a REAPER ${label.toLowerCase()} button labeled "${label}" at ${start[0]}/${start[1]}/${start[2] + index}`);
  }
  const start = range.slice(1, 4).map(Number);
  const end = range.slice(4, 7).map(Number);
  // REAPER's core transport set is always Play, Stop, Record. If the user
  // supplies a wider horizontal span, use its first three positions and leave
  // any extra cells empty instead of rejecting the entire request.
  const horizontal = start[0] === end[0] && start[1] === end[1] && end[2] - start[2] >= 2;
  if (!horizontal) return splitBatchCommands(source);
  return ['PLAY', 'STOP', 'RECORD'].map((label, index) => `Create a REAPER ${label.toLowerCase()} button labeled "${label}" at ${start[0]}/${start[1]}/${start[2] + index}`);
}

export function duplicateLocations(plans) {
  const seen = new Set();
  const duplicates = [];
  for (const plan of plans) {
    const location = plan.button.location;
    const key = `${location.page}/${location.row}/${location.column}`;
    if (seen.has(key) && !duplicates.includes(key)) duplicates.push(key);
    seen.add(key);
  }
  return duplicates;
}
