import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_LANGUAGE_MEMORY = join(homedir(), 'Library', 'Application Support', 'Companion Command Builder', 'language-memory.json');

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\d+/g, '#').replace(/[^a-z#]+/g, ' ').trim();
}

async function readMemory(path = DEFAULT_LANGUAGE_MEMORY) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch { return { format: 'ccb-language-memory', schemaVersion: 1, examples: [] }; }
}

async function saveMemory(memory, path) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(memory, null, 2)}\n`);
  await rename(temporary, path);
}

export async function rememberSuccessfulCommand({ command, moduleId = '', actionId = '', canonicalCommand = '', corrected = false }, path = DEFAULT_LANGUAGE_MEMORY) {
  const phrase = normalize(command);
  if (!phrase || phrase.length > 500) return null;
  const memory = await readMemory(path); memory.examples ||= [];
  const key = `${moduleId}|${actionId}|${phrase}`;
  let example = memory.examples.find((item) => item.key === key);
  if (!example) {
    example = { key, phrase, original: String(command).trim(), moduleId, actionId, canonicalCommand, count: 0, corrected: false, createdAt: new Date().toISOString() };
    memory.examples.push(example);
  }
  example.count += 1; example.lastUsedAt = new Date().toISOString();
  if (canonicalCommand) example.canonicalCommand = canonicalCommand;
  if (corrected) example.corrected = true;
  memory.examples = memory.examples.sort((a, b) => Number(b.corrected) - Number(a.corrected) || b.count - a.count).slice(0, 2000);
  await saveMemory(memory, path);
  return example;
}

export async function languageExamples(command, moduleId = '', limit = 8, path = DEFAULT_LANGUAGE_MEMORY) {
  const query = new Set(normalize(command).split(' ').filter(Boolean));
  const memory = await readMemory(path);
  return (memory.examples || []).filter((item) => !moduleId || !item.moduleId || item.moduleId === moduleId).map((item) => {
    const words = new Set(item.phrase.split(' '));
    const overlap = [...query].filter((word) => words.has(word)).length;
    return { ...item, score: overlap * 10 + Math.log2((item.count || 0) + 1) + (item.corrected ? 20 : 0) };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

