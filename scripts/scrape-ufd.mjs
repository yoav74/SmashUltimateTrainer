// Builds src/data/frameData.json from ultimateframedata.com.
// Pages are cached in .cache/ufd so re-runs don't hit the site again.
// Usage: npm run scrape            (uses cache)
//        npm run scrape -- --fresh (re-download everything)
import { parse } from 'node-html-parser';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://ultimateframedata.com';
const CACHE = path.resolve('.cache/ufd');
const OUT = path.resolve('src/data/frameData.json');
const FRESH = process.argv.includes('--fresh');
const DELAY_MS = 1200;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

async function fetchPage(slug) {
  const file = path.join(CACHE, `${slug}.html`);
  if (!FRESH) {
    try { return { html: await fs.readFile(file, 'utf8'), cached: true }; } catch {}
  }
  const res = await fetch(`${BASE}/${slug}`, { headers: { 'User-Agent': 'smash-trainer personal project' } });
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
  const html = await res.text();
  await fs.writeFile(file, html);
  return { html, cached: false };
}

/** First integer in a string, or null ("--", "**", etc). */
function firstInt(s) {
  const m = /[-+]?\d+/.exec(s ?? '');
  return m ? parseInt(m[0], 10) : null;
}

/** "-14/-10" -> [-14, -10]; "--/-21" -> [null, -21] (keeps alignment with hitbox names) */
function intList(s) {
  return (s ?? '').split('/').map(firstInt);
}

function parseMove(el, category) {
  const field = (cls) => {
    const f = el.querySelector(`.${cls}`);
    if (!f) return null;
    const t = clean(f.text);
    return t === '' || t === '--' ? null : t;
  };
  const name = field('movename');
  if (!name) return null;

  const hitboxNames = (field('whichhitbox') ?? '').split('/').map((h) => clean(h.replace(/[()]/g, '')));
  const advantages = intList(field('advantage'));
  return {
    name,
    category,
    startup: firstInt(field('startup')),
    totalFrames: firstInt(field('totalframes')),
    landingLag: firstInt(field('landinglag')),
    endlag: firstInt(field('endlag')),
    damage: (field('basedamage') ?? '').split('/').map((d) => parseFloat(d)).filter((d) => !isNaN(d)),
    shieldAdvantage: advantages
      .map((value, i) => ({ value, hitbox: hitboxNames[i] || null }))
      .filter((a) => a.value !== null),
    raw: {
      startup: field('startup'),
      totalFrames: field('totalframes'),
      landingLag: field('landinglag'),
      activeFrames: field('activeframes'),
      damage: field('basedamage'),
      shieldStun: field('shieldstun'),
      advantage: field('advantage'),
    },
    notes: field('notes'),
    hitboxGifs: el.querySelectorAll('a.hitboximg').map((a) => `${BASE}/${a.getAttribute('data-featherlight')}`),
  };
}

function parseCharacter(slug, html) {
  const root = parse(html);
  const name = clean(root.querySelector('h1.charactername')?.text) || slug;
  const moves = [];
  const stats = {};
  const oos = [];
  let category = 'unknown';

  for (const el of root.querySelectorAll('h2.movecategory, div.movecontainer')) {
    if (el.tagName === 'H2') {
      category = el.getAttribute('id') ?? 'unknown';
      // Kazuya's page splits ground attacks into jab/tilt/crouching/dash/smash/input sections.
      if (/^(jab|tilt|crouching|dash|smash|input)attacks$/.test(category)) category = 'groundattacks';
      continue;
    }
    if (category === 'misc') {
      for (const d of el.querySelectorAll('div')) {
        const t = clean(d.text);
        const cls = d.getAttribute('class') ?? '';
        if (/^oos\d/.test(cls)) {
          // "Out of Shield, Neutral Air, Up Air — 10 frames"
          const m = /Out of Shield,\s*(.+?)\s*—\s*(\d+)\s*frames?/i.exec(t);
          if (m) oos.push({ options: m[1], frame: parseInt(m[2], 10) });
        } else if (t.includes(' — ') && !cls.includes('movename')) {
          const [k, ...v] = t.split(' — ');
          stats[k.trim()] = v.join(' — ').trim();
        }
      }
      continue;
    }
    const move = parseMove(el, category);
    if (move) moves.push(move);
  }
  return { slug, name, moves, oos, stats };
}

async function main() {
  await fs.mkdir(CACHE, { recursive: true });
  await fs.mkdir(path.dirname(OUT), { recursive: true });

  const { html: indexHtml } = await fetchPage('smash');
  const slugs = [...new Set(
    parse(indexHtml).querySelectorAll('a')
      .map((a) => (a.getAttribute('href') ?? '').replace(/^\//, ''))
      .filter((h) => /^[a-z_]+$/.test(h) && !['stats', 'smash', 'sf6'].includes(h)),
  )];
  console.log(`Found ${slugs.length} characters`);

  const characters = [];
  for (const slug of slugs) {
    const { html, cached } = await fetchPage(slug);
    const c = parseCharacter(slug, html);
    characters.push(c);
    console.log(`${cached ? '(cache)' : '(net)  '} ${c.name}: ${c.moves.length} moves, ${c.oos.length} OoS`);
    if (!cached) await sleep(DELAY_MS);
  }

  // Portraits: UFD's small character art, downloaded once into public/ so the app doesn't hotlink them.
  const portraitDir = path.resolve('public/portraits');
  await fs.mkdir(portraitDir, { recursive: true });
  for (const { slug } of characters) {
    const file = path.join(portraitDir, `${slug}.webp`);
    try { await fs.access(file); continue; } catch {}
    const res = await fetch(`${BASE}/characterart/${slug}.webp`, { headers: { 'User-Agent': 'smash-trainer personal project' } });
    if (!res.ok) { console.log(`portrait missing for ${slug} (HTTP ${res.status})`); continue; }
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    await sleep(300);
  }

  const data = { source: BASE, scrapedAt: new Date().toISOString(), characters };
  await fs.writeFile(OUT, JSON.stringify(data));
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
