const aliases = [
  [/(?:\bobs(?:\s+studio)?\b)/i, 'obs-studio'],
  [/(?:\bqlab\b)/i, 'figure53-qlab-advance'],
  [/(?:\batem\b|blackmagic\s+(?:design\s+)?atem)/i, 'bmd-atem'],
  [/(?:\bdigico\b|digico[_ -]?osc)/i, 'digico-osc'],
  [/(?:\bshure(?:\s+wireless)?\b|\baxient(?:\s+digital)?\b|\bAD4[DQ]\b)/i, 'shure-wireless'],
  [/(?:\b(?:waves\s+)?lv1\b)/i, 'waves-lv1'],
  [/(?:\bgeneric\s+midi\b)/i, 'generic-midi'],
  [/(?:\bgeneric\s+osc\b)/i, 'generic-osc'],
  [/(?:\breaper\b)/i, 'cockos-reaper'],
];

const ROUTING_STOPWORDS = new Set(['bitfocus', 'companion', 'connection', 'controller', 'control', 'module', 'plugin', 'the', 'and']);

function normalized(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

export function moduleRoutingAliases(module = {}) {
  const supplied = module.routingAliases || module.compiledAdapter?.routingAliases || [];
  const sources = [module.moduleId, module.name, module.product, ...(module.products || []), ...(module.keywords || []), ...supplied];
  const values = new Set();
  for (const source of sources) {
    const phrase = normalized(source);
    if (!phrase) continue;
    values.add(phrase);
    for (const segment of String(source).split(/[:;/|]/)) {
      const clean = normalized(segment);
      if (clean) values.add(clean);
    }
    for (const token of phrase.split(' ')) if (token.length >= 4 && !ROUTING_STOPWORDS.has(token)) values.add(token);
  }
  return [...values].filter((value) => value.length >= 3 && !ROUTING_STOPWORDS.has(value));
}

function containsAlias(command, alias) {
  return ` ${normalized(command)} `.includes(` ${normalized(alias)} `);
}

export function explicitlyNamedModule(command, onboardedModules = []) {
  const builtIn = aliases.find(([pattern]) => pattern.test(String(command || '')))?.[1];
  if (builtIn) return builtIn;
  const matches = onboardedModules.flatMap((module) => moduleRoutingAliases(module)
    .filter((alias) => containsAlias(command, alias))
    .map((alias) => ({ moduleId: module.moduleId || module.compiledAdapter?.moduleId, alias }))
  ).filter((match) => match.moduleId).sort((left, right) => right.alias.length - left.alias.length);
  if (!matches.length) return '';
  const bestLength = matches[0].alias.length;
  const best = new Set(matches.filter((match) => match.alias.length === bestLength).map((match) => match.moduleId));
  return best.size === 1 ? [...best][0] : '';
}

export function resolveBatchModule(command, selectedModuleId = '', onboardedModules = []) {
  return explicitlyNamedModule(command, onboardedModules) || selectedModuleId || '';
}
