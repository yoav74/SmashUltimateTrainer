import type { Character, Move } from '../data/types';

// Out-of-shield rules, as documented on ultimateframedata.com:
// - Dropping shield takes 11 frames before a grounded move can start.
// - Up B and Up Smash come out directly from shield (no shield drop).
// - Jumping out of shield takes 3 frames (jumpsquat), so aerials are startup + 3.
// - Grabbing right after a hit on shield costs an extra 4 frames.
export const SHIELD_DROP = 11;
export const JUMPSQUAT = 3;
export const SHIELD_GRAB_PENALTY = 4;

export type OosMethod = 'shield drop' | 'direct' | 'jump' | 'shield grab';

export interface PunishOption {
  move: Move;
  /** Frame the hitbox comes out, counting from the moment shieldstun ends. */
  oosFrame: number;
  method: OosMethod;
  /** Rough reward used to rank punishes (highest listed damage; best throw for grabs). */
  reward: number;
}

/** A shielded enemy move the player has to answer. */
export interface Situation {
  attacker: Character;
  move: Move;
  hitbox: string | null;
  /** On-shield advantage for the attacker, e.g. -23. */
  advantage: number;
}

// Per-character exceptions to the general OoS rules.
const CHARACTER_RULES: Record<string, { jumpsquat?: number; excludeMoves?: RegExp }> = {
  kazuya: { jumpsquat: 7 },
  // Listed startup is the projectile/item spawn, not a hitbox that reaches the attacker.
  duck_hunt: { excludeMoves: /Trick Shot/ },
  rob: { excludeMoves: /Gyro/ },
  bowser_jr: { excludeMoves: /spinout/i },
  piranha_plant: { excludeMoves: /Long Stem Strike/ }, // charged move
  // Menu spells aren't reliably available, so they don't count as punishes.
  hero: { excludeMoves: /^(Bang|Kaboom|Sizz|Sizzle|Whack|Thwack|Kamikazee|Magic Burst|Snooze|Flame Slash|Kacrackle Slash|Hatchet Man|Metal Slash)$/ },
};

// UFD names aerial versions several ways: "Hand Slap, Air", "Hammer (Air)", "Down B, Air (Stone, Air)".
const isAirVariant = (name: string) => /, Air\b|\(Air\)/.test(name);
const isFollowUp = (name: string) =>
  /^(Jab [2-9]|Rapid Jab)/.test(name) || (name.includes(',') && !isAirVariant(name)) || /counter/i.test(name);
/** Strips slot and air markers so "Side B (Hammer)" and "Hammer (Air)" both become "Hammer". */
function baseOf(name: string) {
  const n = name.replace(/\s*\(Air\)$/, '');
  const paren = /\(([^)]+)\)/.exec(n);
  return (paren ? paren[1] : n).replace(/, Air$/, '').trim();
}

/** The moves a character can realistically throw out of shield, with their OoS frame. */
export function punishOptions(c: Character): PunishOption[] {
  const options: PunishOption[] = [];
  const rules = CHARACTER_RULES[c.slug] ?? {};
  const jumpsquat = rules.jumpsquat ?? JUMPSQUAT;
  const maxThrow = Math.max(0, ...c.moves.filter((m) => /Throw$/.test(m.name)).flatMap((m) => m.damage));
  const airVariants = new Set(c.moves.filter((m) => isAirVariant(m.name)).map((m) => baseOf(m.name)));

  for (const move of c.moves) {
    if (move.startup === null || isFollowUp(move.name)) continue;
    if (move.notes && /counter/i.test(move.notes)) continue;
    if (rules.excludeMoves?.test(move.name)) continue;
    // Specials: only the standard slots. Other entries are sub-parts ("Holy Water Explosion") whose startup isn't from input.
    if (move.category === 'specialattacks' && !/^(Neutral|Side|Up|Down) B\b/.test(move.name) && !isAirVariant(move.name)) continue;
    const reward = Math.max(0, ...move.damage);

    if (move.category === 'grabs') {
      if (move.name === 'Grab') {
        options.push({ move, oosFrame: move.startup + SHIELD_GRAB_PENALTY, method: 'shield grab', reward: maxThrow });
      }
      continue;
    }
    if (move.damage.length === 0) continue; // not an attack (e.g. Inhale startup, Up B recovery-only)

    if (move.category === 'aerialattacks' || (move.category === 'specialattacks' && isAirVariant(move.name))) {
      options.push({ move, oosFrame: move.startup + jumpsquat, method: 'jump', reward });
    } else if (move.name === 'Up Smash' || move.name.startsWith('Up B')) {
      options.push({ move, oosFrame: move.startup, method: 'direct', reward });
    } else if (move.category === 'specialattacks' && !airVariants.has(baseOf(move.name))) {
      // No separate aerial version listed, so assume the special can be done right after a jump.
      options.push({ move, oosFrame: move.startup + jumpsquat, method: 'jump', reward });
    } else if (move.category === 'groundattacks' || move.category === 'specialattacks') {
      options.push({ move, oosFrame: move.startup + SHIELD_DROP, method: 'shield drop', reward });
    }
  }
  return options.sort((a, b) => a.oosFrame - b.oosFrame);
}

/** Every negative-on-shield move of a character, one entry per hitbox variant. */
export function situationsFor(attacker: Character, opts: { includeSpecials: boolean; includeAerials: boolean }): Situation[] {
  const out: Situation[] = [];
  for (const move of attacker.moves) {
    if (move.category === 'aerialattacks' && !opts.includeAerials) continue;
    if (move.category === 'specialattacks' && !opts.includeSpecials) continue;
    if (!['groundattacks', 'aerialattacks', 'specialattacks'].includes(move.category)) continue;
    if (/^Jab [2-9]/.test(move.name)) continue;
    for (const a of move.shieldAdvantage) {
      if (a.value < 0) out.push({ attacker, move, hitbox: a.hitbox, advantage: a.value });
    }
  }
  return out;
}

export const punishes = (opt: PunishOption, s: Situation) => opt.oosFrame <= -s.advantage;

export interface Grade {
  verdict: 'optimal' | 'correct' | 'wrong';
  punishers: PunishOption[];
  best: PunishOption | null;
}

/** `choice === null` means the player answered "nothing punishes, it's safe". */
export function grade(options: PunishOption[], s: Situation, choice: PunishOption | null): Grade {
  const punishers = options.filter((o) => punishes(o, s));
  const best = punishers.reduce<PunishOption | null>((b, o) => (!b || o.reward > b.reward ? o : b), null);

  if (choice === null) return { verdict: punishers.length === 0 ? 'optimal' : 'wrong', punishers, best };
  if (!punishes(choice, s)) return { verdict: 'wrong', punishers, best };
  return { verdict: best && choice.reward >= best.reward ? 'optimal' : 'correct', punishers, best };
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
