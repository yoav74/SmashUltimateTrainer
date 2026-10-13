import raw from './frameData.json';
import type { Character, FrameData } from './types';

const data = raw as FrameData;

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

export const characters: Character[] = data.characters
  .map((c) => ({ ...c, name: displayName(c.slug) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const characterBySlug = new Map(characters.map((c) => [c.slug, c]));

export const dataSource = { url: data.source, scrapedAt: data.scrapedAt };
