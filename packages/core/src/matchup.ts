import { grade, punishOptions, situationsFor, type PunishOption, type Situation } from './punish';
import type { Spacing } from './reach';
import type { Character } from './types';

export interface PunishRow {
  situation: Situation;
  /** The defender's options that are fast enough and reach. */
  punishers: PunishOption[];
  /** Fast enough, but out of range at this spacing. */
  outOfRange: PunishOption[];
  /** Fast enough and in range, but the attacker is intangible when they'd hit. */
  intangible: PunishOption[];
  /** Punishes that start while a re-hitting move is still active: 'beats' with invincibility, or may 'trade'. */
  lingering: Map<PunishOption, 'beats' | 'trade'>;
  best: PunishOption | null;
}

/**
 * Every move of `attacker` that's negative on shield, with how `defender` punishes it out of shield.
 * Sorted from most to least punishable (most negative first).
 */
export function punishTable(attacker: Character, defender: Character, spacing: Spacing): PunishRow[] {
  const options = punishOptions(defender);
  const ctx = { spacing, defender, iframes: true };
  return situationsFor(attacker, { includeAerials: true, includeSpecials: true })
    .map((situation) => {
      const g = grade(options, situation, null, ctx);
      return { situation, punishers: g.punishers, outOfRange: g.outOfRange, intangible: g.intangible, lingering: g.lingering, best: g.best };
    })
    .sort((a, b) => a.situation.advantage - b.situation.advantage);
}

export interface MatchupSummary {
  /** Negative-on-shield move variants the attacker has. */
  shielded: number;
  /** How many of those the defender can punish. */
  punishable: number;
}

export const summarize = (rows: PunishRow[]): MatchupSummary => ({
  shielded: rows.length,
  punishable: rows.filter((r) => r.best).length,
});
