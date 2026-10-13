import fs from 'node:fs/promises';

/**
 * Writes `{ [stampKey]: now, ...payload }` as indented JSON (so git diffs are readable),
 * but leaves the file untouched when only the timestamp would change. That way the
 * weekly refresh only opens a PR when the data itself changed.
 */
export async function writeJsonIfChanged(file, stampKey, payload) {
  let old = null;
  try { old = JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  if (old) {
    const { [stampKey]: _, ...oldPayload } = old;
    if (JSON.stringify(oldPayload) === JSON.stringify(payload)) return false;
  }
  await fs.writeFile(file, JSON.stringify({ [stampKey]: new Date().toISOString(), ...payload }, null, 1) + '\n');
  return true;
}
