// Builds generated/hitboxes.json from SmashWiki (CC BY-SA):
//  - per-move hitbox and grabbox tables (radius, bone, offsets) from "<Fighter> (SSBU)/<Move>" pages
//  - per-fighter traction (used for shield pushback distance)
// Usage: npm run scrape:hitboxes   (raw page text is cached in .cache/ssbwiki)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeJsonIfChanged } from './write-json.mjs';

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const API = 'https://www.ssbwiki.com/api.php';
const UA = { 'User-Agent': 'smash-trainer (github.com/yoav74/SmashUltimateTrainer)' };
const CACHE = path.join(PKG, '.cache/ssbwiki');
const OUT = path.join(PKG, 'generated/hitboxes.json');
const FRAME_DATA = path.join(PKG, 'generated/frameData.json');
const FRESH = process.argv.includes('--fresh');

// The SmashWiki move pages the punish engine can use.
const MOVE_PAGES = [
  'Neutral attack', 'Neutral attack/Hit 1', 'Forward tilt', 'Up tilt', 'Down tilt', 'Dash attack',
  'Forward smash', 'Up smash', 'Down smash',
  'Neutral aerial', 'Forward aerial', 'Back aerial', 'Up aerial', 'Down aerial', 'Grab aerial',
  'Neutral special', 'Side special', 'Up special', 'Down special', 'Grab',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/é/g, 'e').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function cached(key, fn) {
  const file = path.join(CACHE, `${key.replace(/[^a-z0-9_-]/gi, '_')}.json`);
  if (!FRESH) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch {}
  }
  const value = await fn();
  await fs.writeFile(file, JSON.stringify(value));
  await sleep(600);
  return value;
}

const wikitextOf = async (title) => (await api({ action: 'parse', page: title, prop: 'wikitext' })).parse.wikitext;

/** Ultimate traction table → { 'Lucas': 0.11, ... } (handles rowspans for ties). */
function parseTraction(wikitext) {
  const start = wikitext.indexOf("Super Smash Bros. Ultimate]]''===");
  const table = wikitext.slice(start, wikitext.indexOf('|}', start));
  const out = {};
  let carried = null;
  for (const row of table.split('|-').slice(1)) {
    const name = /\{\{CharHead\|([^|}]+)\|SSBU[|}]/.exec(row)?.[1]; // e.g. {{CharHead|R.O.B.|SSBU|color=Grey}}
    const value = /\|\|\s*(?:rowspan=\d+\|)?([0-9.]+)/.exec(row)?.[1];
    if (value) carried = parseFloat(value);
    if (name && carried != null) out[name] = carried;
  }
  return out;
}

/** "0.0 to -0.7" → [-0.7, 0]; "5.9" → [5.9, 5.9]; missing → [0, 0]. */
function range(v) {
  const nums = (v ?? '0').split(/\s*to\s*/).map(parseFloat).filter((n) => !isNaN(n));
  return nums.length ? [Math.min(...nums), Math.max(...nums)] : [0, 0];
}

/** Hitbox/grabbox rows, grouped by the table title or section heading they sit under. */
function parseMovePage(wikitext) {
  const groups = [];
  let current = null;
  const re = /\{\{HitboxTableTitle\|([^|}]*)[^}]*\}\}|^===+\s*(.+?)\s*===+\s*$|\{\{Ultimate(Hitbox|Grabbox)TableRow([\s\S]*?)\n\}\}/gm;
  for (const m of wikitext.matchAll(re)) {
    if (m[1] !== undefined || m[2] !== undefined) {
      current = { title: (m[1] ?? m[2]).trim(), boxes: [] };
      groups.push(current);
      continue;
    }
    const field = (k) => new RegExp(`[|]${k}=([^\\n|]*)`).exec(m[4])?.[1]?.trim();
    if (!current) {
      current = { title: '', boxes: [] };
      groups.push(current);
    }
    current.boxes.push({
      kind: m[3] === 'Grabbox' ? 'grab' : 'hit',
      id: parseInt(field('id') ?? '0', 10),
      damage: parseFloat(field('damage') ?? '') || null,
      r: parseFloat(field('r') ?? '') || 0,
      bone: field('bn') ?? null,
      x: range(field('xpos')),
      y: range(field('ypos')),
      z: range(field('zpos')),
      // Grabboxes: g=f means it can't grab grounded opponents, a=f airborne ones.
      grounded: field('g') !== 'f',
      airborne: field('a') !== 'f',
    });
  }
  return groups.filter((g) => g.boxes.length);
}

async function main() {
  await fs.mkdir(CACHE, { recursive: true });
  const slugs = JSON.parse(await fs.readFile(FRAME_DATA, 'utf8')).characters.map((c) => c.slug);

  const traction = parseTraction(await cached('Traction', () => wikitextOf('Traction')));
  // The traction table names every fighter the way SmashWiki titles their pages.
  const wikiName = new Map(Object.keys(traction).map((n) => [norm(n), n]));
  const ALIASES = { pt_squirtle: 'squirtle', pt_ivysaur: 'ivysaur', pt_charizard: 'charizard', minmin: 'minmin' };

  const fighters = {};
  for (const slug of slugs) {
    const name = wikiName.get(ALIASES[slug] ?? norm(slug.replace(/_/g, ' ')));
    if (!name) { console.log(`  no SmashWiki name for ${slug}`); continue; }

    const titles = MOVE_PAGES.map((p) => `${name} (SSBU)/${p}`);
    const pages = await cached(`moves_${slug}`, async () => {
      const j = await api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.join('|') });
      return Object.fromEntries(j.query.pages.filter((p) => !p.missing).map((p) => [p.title, p.revisions[0].slots.main.content]));
    });

    const moves = {};
    for (const [title, text] of Object.entries(pages)) {
      const groups = parseMovePage(text);
      if (groups.length) moves[title.split('/').slice(1).join('/')] = groups;
    }
    fighters[slug] = { wikiName: name, traction: traction[name] ?? null, moves };
    console.log(`  ${name}: ${Object.keys(moves).length}/${MOVE_PAGES.length} move pages with hitbox data, traction ${traction[name]}`);
  }

  const changed = await writeJsonIfChanged(OUT, 'scrapedAt', { source: 'https://www.ssbwiki.com', license: 'CC BY-SA 3.0', fighters });
  console.log(changed ? `Wrote ${OUT}` : 'Hitbox data unchanged');
  const missing = slugs.filter((s) => !fighters[s]);
  if (missing.length) console.log(`Missing fighters: ${missing.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
