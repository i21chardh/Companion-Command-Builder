#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { mergeConfig } from './config.js';
import { parseCommand } from './parser.js';
import { buildDeploymentPlan } from './plan.js';

function usage() {
  return `Usage:
  npm start -- "create a button in column 1 row 3 that will mute channel 36"
  node src/cli.js --config config.json "...command..."

Options:
  --config <path>  Load local settings and the Companion connection label
  --compact        Print compact JSON
  --help           Show this help`;
}

async function main(argv) {
  let configPath;
  let compact = false;
  const commandParts = [];

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--help') return console.log(usage());
    if (argv[i] === '--compact') compact = true;
    else if (argv[i] === '--config') configPath = argv[++i];
    else commandParts.push(argv[i]);
  }

  if (!commandParts.length) throw new Error(`Missing command.\n\n${usage()}`);
  const overrides = configPath ? JSON.parse(await readFile(configPath, 'utf8')) : {};
  const config = mergeConfig(overrides);
  const parsed = parseCommand(commandParts.join(' '), { defaultPage: config.companion.defaultPage });
  const plan = buildDeploymentPlan(parsed, config);
  console.log(JSON.stringify(plan, null, compact ? 0 : 2));
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`${error.name}: ${error.message}`);
  process.exitCode = 1;
});
