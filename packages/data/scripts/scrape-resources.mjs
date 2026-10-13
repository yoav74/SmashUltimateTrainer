// Builds src/data/resources.json: per-fighter community resources.
//  - Documents, videos and "Players to Watch" from dragdown.wiki's SSBU/<Fighter>/Resources pages
//  - Character Discord invites from SmashWiki's Discord page, checked against Discord's invite API
// Usage: npm run scrape:resources
import { parse } from 'node-html-parser';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Paths are relative to packages/data, wherever the script is run from.
const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const UA = { 'User-Agent': 'smash-trainer personal project' };
const DD_API = 'https://dragdown.wiki/w/api.php';
const OUT = path.join(PKG, 'generated/resources.json');
const INVITE_CACHE = path.join(PKG, '.cache/discord-check.json');
const FRAME_DATA = path.join(PKG, 'generated/frameData.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.toLowerCase().replace(/é/g, 'e').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** Maps a fighter name as other sites write it ("Samus & Dark Samus", "Pokemon Trainer") to our slugs. */
function slugMatcher(slugs) {
  const bySlug = new Map(slugs.map((s) => [norm(s), s]));
  return (name) => {
    const n = norm(name);
    if (n === 'pokemontrainer') return slugs.filter((s) => s.startsWith('pt_'));
    if (bySlug.has(n)) return [bySlug.get(n)];
    // "Peach & Daisy", "Pyra & Mythra": each part on its own.
    const parts = name.split('&').map((p) => bySlug.get(norm(p))).filter(Boolean);
    return parts.length > 1 ? parts : [];
  };
}

// ---------- dragdown ----------

async function listSsbuPages() {
  const titles = [];
  let cont = '';
  do {
    const j = await getJson(`${DD_API}?action=query&list=allpages&apprefix=SSBU/&apnamespace=0&aplimit=500&format=json${cont}`);
    titles.push(...j.query.allpages.map((p) => p.title));
    cont = j.continue ? `&apcontinue=${encodeURIComponent(j.continue.apcontinue)}` : '';
  } while (cont);
  return titles;
}

// ---------- smasharchives (tournament VODs per fighter) ----------

const ARCHIVE_CACHE = path.join(PKG, '.cache/smasharchives.json');

/** smasharchives.com/character/<id> ids, found by reading each page's title ("Mario VODs - Smasharchives"). */
async function smasharchivesIds() {
  try { return JSON.parse(await fs.readFile(ARCHIVE_CACHE, 'utf8')); } catch {}
  const ids = {};
  for (let id = 1, misses = 0; misses < 3; id++) {
    const res = await fetch(`https://smasharchives.com/character/${id}`, { headers: UA });
    const title = /<title>([^<]*) VODs - Smasharchives/.exec(await res.text())?.[1];
    if (title) { ids[title] = id; misses = 0; } else misses++;
    await sleep(400);
  }
  await fs.writeFile(ARCHIVE_CACHE, JSON.stringify(ids, null, 1));
  return ids;
}

const stripWiki = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/^[*#:;\s-]+/, '')
    .replace(/[\s:–—-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

function kindOf(url) {
  if (/docs\.google\.com\/spreadsheets/.test(url)) return 'sheet';
  if (/docs\.google\.com\/(document|presentation)/.test(url)) return 'doc';
  if (/youtube\.com|youtu\.be|twitch\.tv/.test(url)) return 'video';
  if (/twitter\.com|x\.com/.test(url)) return 'tweet';
  if (/discord\.(gg|com)/.test(url)) return 'discord';
  return 'link';
}

function parseResourcesWikitext(wikitext) {
  const players = [];
  for (const m of wikitext.matchAll(/\{\{PlayersToWatchEntry([\s\S]*?)\n\}\}/g)) {
    const field = (k) => new RegExp(`\\|\\s*${k}\\s*=\\s*([^\\n]*)`).exec(m[1])?.[1].trim() || null;
    const name = field('Name');
    if (name) players.push({ name, region: field('Region'), footage: field('Footage'), note: field('Note') });
  }

  const links = [];
  let section = 'Other';
  const body = wikitext.replace(/\{\{PlayersToWatch[\s\S]*?<!---End of PlayersToWatch--->/g, '');
  for (const line of body.split('\n')) {
    const h = /^(=+)\s*(.+?)\s*\1\s*$/.exec(line);
    if (h) { section = h[2]; continue; }
    // [url label] links first, then bare URLs labeled by the surrounding text.
    let rest = line;
    for (const m of line.matchAll(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g)) {
      links.push({ section, label: stripWiki(m[2]), url: m[1], kind: kindOf(m[1]) });
      rest = rest.replace(m[0], ' ');
    }
    // Trailing ' excluded: '''bold''' markup often hugs a URL.
    const bare = [...rest.matchAll(/https?:\/\/[^\s\]|}<']+/g)].map((m) => m[0]);
    if (bare.length) {
      const label = stripWiki(rest.replace(/https?:\/\/[^\s\]|}<']+/g, ' '));
      for (const url of bare) links.push({ section, label: label || null, url, kind: kindOf(url) });
    }
  }
  return { players, links };
}

// ---------- discord ----------

async function smashwikiDiscords() {
  const res = await fetch('https://www.ssbwiki.com/Discord', { headers: UA });
  const root = parse(await res.text());
  const table = root.querySelectorAll('table').find((t) => /Character/.test(t.querySelector('tr')?.text ?? '') && t.querySelectorAll('tr').length > 50);
  return table.querySelectorAll('tr').slice(1).map((tr) => ({
    name: tr.querySelector('td').text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim(),
    urls: tr.querySelectorAll('a').map((a) => a.getAttribute('href')).filter((h) => /discord\.gg/.test(h)),
  }));
}

async function checkInvites(urls) {
  let cache = [];
  try { cache = JSON.parse(await fs.readFile(INVITE_CACHE, 'utf8')); } catch {}
  const byUrl = new Map(cache.map((c) => [c.url, c]));
  for (const url of urls) {
    if (byUrl.has(url)) continue;
    const code = url.split('/').pop();
    const res = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`);
    const j = await res.json().catch(() => ({}));
    byUrl.set(url, { url, status: res.status, guild: j.guild?.name ?? null, members: j.approximate_member_count ?? null });
    console.log(`  invite ${code}: ${res.status} ${j.guild?.name ?? j.message ?? ''}`);
    await sleep(1200);
  }
  await fs.writeFile(INVITE_CACHE, JSON.stringify([...byUrl.values()], null, 1));
  return byUrl;
}

// ---------- titles for unlabeled links ----------

const TITLE_CACHE = path.join(PKG, '.cache/link-titles.json');

async function fetchTitle(url, kind) {
  if (kind === 'video' && /youtube\.com|youtu\.be/.test(url)) {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    return res.ok ? (await res.json()).title : null;
  }
  if (kind === 'doc' || kind === 'sheet') {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) return null;
    const t = /<title>([^<]*)<\/title>/.exec(await res.text())?.[1];
    // Private docs return a sign-in page instead of the document.
    if (!t || /Sign in|Google Accounts/i.test(t)) return null;
    return t.replace(/ - Google (Docs|Sheets|Slides|Drive)$/, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
  }
  return null;
}

/** Fills `label` (and `title` for player footage) in place. */
async function resolveTitles(links) {
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(TITLE_CACHE, 'utf8')); } catch {}
  let fetched = 0;
  for (const l of links) {
    if (!l.url || (l.label && !l.isFootage)) continue;
    if (!(l.url in cache)) {
      try { cache[l.url] = await fetchTitle(l.url, l.kind); } catch { cache[l.url] = null; }
      if (++fetched % 20 === 0) console.log(`  resolved ${fetched} titles…`);
      await sleep(250);
    }
    if (cache[l.url]) l.isFootage ? (l.title = cache[l.url]) : (l.label = cache[l.url]);
  }
  await fs.writeFile(TITLE_CACHE, JSON.stringify(cache, null, 1));
}

// ---------- main ----------

async function main() {
  const slugs = JSON.parse(await fs.readFile(FRAME_DATA, 'utf8')).characters.map((c) => c.slug);
  const match = slugMatcher(slugs);
  const out = Object.fromEntries(slugs.map((s) => [s, { discords: [], players: [], links: [], sources: [], wiki: null, vodArchive: null }]));

  const allPages = await listSsbuPages();
  for (const title of allPages.filter((t) => /^SSBU\/[^/]+$/.test(t))) {
    for (const s of match(title.split('/')[1])) out[s].wiki ??= `https://dragdown.wiki/wiki/${title.replace(/ /g, '_')}`;
  }
  for (const [title, id] of Object.entries(await smasharchivesIds())) {
    // Titles look like "Mr. Game &amp; Watch" or "Pyra/Mythra".
    for (const name of title.replace(/&amp;/g, '&').split('/')) {
      for (const s of match(name)) out[s].vodArchive ??= `https://smasharchives.com/character/${id}`;
    }
  }

  const pages = allPages.filter((t) => /^SSBU\/[^/]+\/Resources$/.test(t));
  console.log(`dragdown: ${pages.length} resource pages`);
  for (const title of pages) {
    const fighter = title.split('/')[1];
    const targets = match(fighter);
    if (!targets.length) { console.log(`  skip ${title} (no matching fighter)`); continue; }
    const j = await getJson(`${DD_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`);
    const { players, links } = parseResourcesWikitext(j.parse.wikitext);
    for (const s of targets) {
      out[s].players.push(...players);
      out[s].links.push(...links);
      out[s].sources.push(`https://dragdown.wiki/wiki/${title.replace(/ /g, '_')}`);
    }
    console.log(`  ${fighter}: ${players.length} players, ${links.length} links`);
    await sleep(500);
  }

  // Discord invites: SmashWiki's table, plus any discord.gg links on the dragdown pages. Only live ones are kept.
  const discordRows = await smashwikiDiscords();
  const dragdownInvites = slugs.flatMap((s) => out[s].links.filter((l) => /discord\.gg\//.test(l.url)).map((l) => ({ slug: s, url: l.url })));
  const invites = await checkInvites([...discordRows.flatMap((r) => r.urls), ...dragdownInvites.map((d) => d.url)]);
  const addInvite = (slug, url) => {
    const inv = invites.get(url);
    if (inv?.status !== 200 || out[slug].discords.some((d) => d.name === inv.guild)) return;
    out[slug].discords.push({ url, name: inv.guild, members: inv.members });
  };
  for (const row of discordRows) for (const s of match(row.name)) for (const url of row.urls) addInvite(s, url);
  for (const d of dragdownInvites) addInvite(d.slug, d.url);
  for (const s of slugs) out[s].links = out[s].links.filter((l) => l.kind !== 'discord');

  await resolveTitles(slugs.flatMap((s) => [...out[s].links, ...out[s].players.map((p) => ({ url: p.footage, kind: 'video', isFootage: true, set title(t) { p.footageTitle = t; } }))]));

  await fs.writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), fighters: out }, null, 1));
  const missing = slugs.filter((s) => !out[s].links.length && !out[s].players.length);
  console.log(`Wrote ${OUT}. No dragdown resources for: ${missing.join(', ')}`);
  console.log(`No live Discord for: ${slugs.filter((s) => !out[s].discords.length).join(', ') || 'none'}`);
  console.log(`No wiki page for: ${slugs.filter((s) => !out[s].wiki).join(', ') || 'none'}`);
  console.log(`No VOD archive for: ${slugs.filter((s) => !out[s].vodArchive).join(', ') || 'none'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
