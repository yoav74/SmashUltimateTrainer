import { moveReach, sizeProxy, TETHER_GRABS, wikiPageFor, type Character, type FrameData, type HitboxGroup } from '@smash-trainer/core';
import raw from '../generated/frameData.json';
import hitboxRaw from '../generated/hitboxes.json';
import { parseInvulnerability } from './iframes';

const data = raw as FrameData;
const hitboxes = (hitboxRaw as unknown as { fighters: Record<string, { traction: number | null; moves: Record<string, HitboxGroup[]> }> }).fighters;

// UFD's page titles are inconsistently cased, so names are derived from slugs.
const NAME_OVERRIDES: Record<string, string> = {
  banjo_and_kazooie: 'Banjo & Kazooie',
  bowser_jr: 'Bowser Jr.',
  dr_mario: 'Dr. Mario',
  king_k_rool: 'King K. Rool',
  minmin: 'Min Min',
  mr_game_and_watch: 'Mr. Game & Watch',
  pac_man: 'Pac-Man',
  pt_squirtle: 'Squirtle (PT)',
  pt_ivysaur: 'Ivysaur (PT)',
  pt_charizard: 'Charizard (PT)',
  rob: 'R.O.B.',
  rosalina_and_luma: 'Rosalina & Luma',
};

function displayName(slug: string) {
  return NAME_OVERRIDES[slug] ?? slug.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** Variants like "Devil Blaster, Air" often have no GIF of their own; borrow the base move's. */
function withGifFallbacks(c: Character): Character {
  const moves = c.moves.map((m) => {
    if (m.hitboxGifs.length) return m;
    const base = m.name.split(',')[0].replace(/\s*\(.*\)$/, '').trim();
    const donor = c.moves.find((o) => o !== m && o.hitboxGifs.length && o.name.includes(base));
    return donor ? { ...m, hitboxGifs: donor.hitboxGifs } : m;
  });
  return { ...c, moves };
}

const stat = (c: Character, key: string, fallback: number) => {
  const v = parseFloat(c.stats[key] ?? '');
  return Number.isNaN(v) ? fallback : v;
};

/** Attaches SmashWiki reach to each move and the movement numbers the range model needs. */
function withRange(c: Character): Character {
  const hb = hitboxes[c.slug];
  if (!hb) return c;
  const tether = TETHER_GRABS.has(c.slug);
  const grab = hb.moves['Grab'] && !tether ? moveReach(hb.moves['Grab'], 99, { grab: true }) : null;
  const size = sizeProxy(grab?.units ?? null);
  const moves = c.moves.map((m) => {
    const page = wikiPageFor(m.name);
    const groups = page && (hb.moves[page] ?? (page === 'Neutral attack/Hit 1' ? hb.moves['Neutral attack'] : undefined));
    if (!groups || (page === 'Grab' && tether)) return m;
    return { ...m, reach: moveReach(groups, size, { grab: page === 'Grab', backward: page === 'Back aerial' }) };
  });
  return {
    ...c,
    moves,
    physics: {
      traction: hb.traction ?? 0.11,
      size,
      airSpeed: stat(c, 'Air Speed', 1),
      airAccel: stat(c, 'Total Air Acceleration', 0.08),
      initialDash: stat(c, 'Initial Dash', 1.8),
    },
  };
}

/** Intangibility / armor windows parsed from each move's UFD notes. */
function withIframes(c: Character): Character {
  return { ...c, moves: c.moves.map((m) => ({ ...m, iframes: parseInvulnerability(m.notes) })) };
}

export const characters: Character[] = data.characters
  .map((c) => withIframes(withRange(withGifFallbacks({ ...c, name: displayName(c.slug) }))))
  .sort((a, b) => a.name.localeCompare(b.name));

export const characterBySlug = new Map(characters.map((c) => [c.slug, c]));

export const dataSource = { url: data.source, scrapedAt: data.scrapedAt };
