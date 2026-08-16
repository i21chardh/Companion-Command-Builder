import { readFile, writeFile } from 'node:fs/promises';

export function validPresetPath(value) {
  const path = String(value || '');
  if (!path.startsWith('/') || path.includes('\0')) throw new Error('A valid local preset file is required.');
  if (!/\.(?:json|ccb-layout)$/i.test(path)) throw new Error('Preset files must end in .json or .ccb-layout.');
  return path;
}

export function validatePresetEnvelope(document) {
  if (document?.format !== 'companion-command-builder-layout' || document.schemaVersion !== 1) throw new Error('The supplied preset document is invalid.');
  if (!Array.isArray(document.pages) || !document.pages.length) throw new Error('The supplied preset contains no pages.');
  return document;
}

export function serializePresetDocument(document) {
  return `${JSON.stringify(validatePresetEnvelope(document), null, 2)}\n`;
}

export function deserializePresetDocument(content) {
  return validatePresetEnvelope(JSON.parse(String(content)));
}

export async function savePresetFile(path, document) {
  const target = validPresetPath(path);
  await writeFile(target, serializePresetDocument(document), 'utf8');
  return target;
}

export async function loadPresetFile(path) {
  const target = validPresetPath(path);
  return deserializePresetDocument(await readFile(target, 'utf8'));
}
