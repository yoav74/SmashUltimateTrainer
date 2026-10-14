import type { Character, Invulnerability, Move } from './types';
import { aerialDrift, ESTIMATE, pushback, requiredReach, shieldstunFromDamage, type Spacing } from './reach';

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
  /** Distance the character moves toward the opponent before the hitbox comes out (aerial drift, dash attack). */
  travel: number;
}

/** A shielded enemy move the player has to answer. */
export interface Situation {
  attacker: Character;
  move: Move;
  hitbox: string | null;
  /** On-shield advantage for the attacker, e.g. -23. */
  advantage: number;
  /** Damage and shieldstun of this hitbox, for shield pushback. */
  damage: number;
  shieldstun: number;
  /** Frame of the attacker's animation this hitbox connects on (its first active frame). */
  hitFrame: number;
  /** Last active frame of any of the move's hitboxes. */
  lastActive: number;
}

/** What the range check needs to know: spacing assumption and who is shielding. */
export interface PunishContext {
  spacing: Spacing;
  defender: Character;
  /** Also check intangibility (punish lands while they're intangible) and lingering hitboxes. Off unless set. */
  iframes?: boolean;
}

// Per-character exceptions to the general OoS rules.
const CHARACTER_RULES: Record<string, { jumpsquat?: number; excludeMoves?: RegExp }> = {
  kazuya: { jumpsquat: 7, excludeMoves: /\(Final Hit\)|Taunt/ },
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
  /^(Jab ([2-9]|\d{2})|Rapid Jab)/.test(name) || (name.includes(',') && !isAirVariant(name)) || /counter/i.test(name);
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
        options.push({ move, oosFrame: move.startup + SHIELD_GRAB_PENALTY, method: 'shield grab', reward: maxThrow, travel: 0 });
      }
      continue;
    }
    if (move.damage.length === 0) continue; // not an attack (e.g. Inhale startup, Up B recovery-only)

    if (move.category === 'aerialattacks' || (move.category === 'specialattacks' && isAirVariant(move.name))) {
      options.push({ move, oosFrame: move.startup + jumpsquat, method: 'jump', reward, travel: 0 });
    } else if (move.name === 'Up Smash' || move.name.startsWith('Up B')) {
      options.push({ move, oosFrame: move.startup, method: 'direct', reward, travel: 0 });
    } else if (move.category === 'specialattacks' && !airVariants.has(baseOf(move.name))) {
      // No separate aerial version listed, so assume the special can be done right after a jump.
      options.push({ move, oosFrame: move.startup + jumpsquat, method: 'jump', reward, travel: 0 });
    } else if (move.category === 'groundattacks' || move.category === 'specialattacks') {
      options.push({ move, oosFrame: move.startup + SHIELD_DROP, method: 'shield drop', reward, travel: 0 });
    }
  }
  const p = c.physics;
  for (const o of options) {
    if (!p || o.move.startup == null) continue;
    if (o.method === 'jump') o.travel = aerialDrift(o.move.startup, p.airSpeed, p.airAccel);
    else if (/^Dash Attack/.test(o.move.name)) o.travel = Math.round(p.initialDash * o.move.startup * ESTIMATE.dashAttackTravel * 10) / 10;
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
    if (/^Jab ([2-9]|\d{2})/.test(move.name)) continue;
    move.shieldAdvantage.forEach((a, i) => {
      if (a.value >= 0) return;
      const damage = move.damage[i] ?? Math.max(0, ...move.damage);
      const listedStun = parseInt((move.raw.shieldStun ?? '').split('/')[i] ?? '', 10);
      const shieldstun = Number.isNaN(listedStun) ? shieldstunFromDamage(damage) : listedStun;
      // Active frames look like "13—15/16—19" (one range per hitbox, same order as the advantages).
      // Worded asides like "(full extended 26—66)" are optional variants, not this move's normal active frames.
      const active = (move.raw.activeFrames ?? '').replace(/\([^)]*[a-z][^)]*\)/gi, '');
      // Only the range of the hitbox that connected: a hitbox hits a target once, so other hitboxes (down smash's
      // second side, later sweetspots) don't threaten you; repeating multi-hits stay inside their own range.
      const segment = active.split('/')[i] ?? active;
      const hitFrame = parseInt(/\d+/.exec(segment)?.[0] ?? '', 10) || move.startup || 1;
      const lastActive = Math.max(hitFrame, ...(segment.match(/\d+/g) ?? []).map(Number).filter(Number.isFinite));
      out.push({ attacker, move, hitbox: a.hitbox, advantage: a.value, damage, shieldstun, hitFrame, lastActive });
    });
  }
  return out;
}

/** Fast enough: the hitbox comes out inside the frame window. */
export const fastEnough = (opt: PunishOption, s: Situation) => opt.oosFrame <= -s.advantage;

/** How far forward a punish needs to reach in this situation (null when range is ignored or unknown). */
export function reachNeeded(s: Situation, ctx?: PunishContext): number | null {
  if (!ctx || ctx.spacing === 'off') return null;
  const a = s.attacker.physics;
  const d = ctx.defender.physics;
  if (!a || !d) return null;
  return requiredReach({
    spacing: ctx.spacing,
    attackerReach: s.move.reach?.units ?? null,
    attackerSize: a.size,
    defenderSize: d.size,
    pushback: pushback({ shieldstun: s.shieldstun, damage: s.damage, defenderTraction: d.traction, attackerTraction: a.traction }),
  });
}

/** Long enough: the punish reaches the attacker after pushback. Moves without reach data get the benefit of the doubt. */
export function reaches(opt: PunishOption, s: Situation, ctx?: PunishContext): boolean {
  const needed = reachNeeded(s, ctx);
  if (needed == null || !opt.move.reach) return true;
  return opt.move.reach.units + opt.travel >= needed;
}

/**
 * Frame of the attacker's animation when the punish's hitbox comes out: they hit your shield on hitFrame, keep
 * animating through your shieldstun, then your option takes oosFrame frames. (Shieldlag freezes both, so it cancels.)
 */
export const attackerFrameAtPunish = (opt: PunishOption, s: Situation) => s.hitFrame + s.shieldstun + opt.oosFrame;

/** Aerials land on shield, so their animation (and its intangibility) is over by the time a punish lands. */
const landsOnShield = (m: Move) => m.category === 'aerialattacks' || isAirVariant(m.name);

/** The attacker's full-body intangible window the punish would land in, if any (only with ctx.iframes). */
export function intangibleAt(opt: PunishOption, s: Situation, ctx?: PunishContext): { window: Invulnerability; frame: number } | null {
  if (!ctx?.iframes || landsOnShield(s.move)) return null;
  const frame = attackerFrameAtPunish(opt, s);
  const window = s.move.iframes?.find((w) => w.kind === 'intangible' && w.full && w.only !== 'air' && frame >= w.start && frame <= w.end);
  return window ? { window, frame } : null;
}

export const punishes = (opt: PunishOption, s: Situation, ctx?: PunishContext) =>
  fastEnough(opt, s) && reaches(opt, s, ctx) && !intangibleAt(opt, s, ctx);

/** Moves whose hitboxes repeat on the same target: UFD marks them "Multi"/"rehit"/"hits every N frames". */
export const rehits = (s: Situation) =>
  /multi|loop|rapid/i.test(s.hitbox ?? '') || /rehit/i.test(s.move.raw.activeFrames ?? '') || /rehit|hits every|multi-?hit/i.test(s.move.notes ?? '');

/**
 * Lingering hitboxes: when the attacker's move is still active after your shieldstun ends, starting a punish exposes
 * you (multi-hit and late hitboxes can still hit you). An option whose own full-body intangibility covers every
 * exposed frame (e.g. Corrin's Up B) beats it; others may trade. Flag only: this doesn't change the verdict.
 */
export function lingering(opt: PunishOption, s: Situation, ctx?: PunishContext): 'beats' | 'trade' | null {
  // Aerials' hitboxes end when they land. And a move normally hits a target only once, so only re-hitting moves
  // (multi-hits, looping hitboxes) can still hit you after already hitting your shield.
  if (!ctx?.iframes || landsOnShield(s.move) || !rehits(s)) return null;
  const actable = s.hitFrame + s.shieldstun + 1; // attacker frame when you can first act
  const exposedUntil = Math.min(s.lastActive, attackerFrameAtPunish(opt, s) - 1);
  if (!Number.isFinite(exposedUntil) || exposedUntil < actable) return null;
  // Your option's own frame f happens on attacker frame actable - 1 + (oosFrame - startup) + f.
  const offset = actable - 1 + (opt.oosFrame - (opt.move.startup ?? opt.oosFrame));
  const iframes = (opt.move.iframes ?? []).filter((w) => w.kind === 'intangible' && w.full);
  for (let frame = actable; frame <= exposedUntil; frame++) {
    const own = frame - offset;
    if (!iframes.some((w) => own >= w.start && own <= w.end)) return 'trade';
  }
  return 'beats';
}

export interface Grade {
  verdict: 'optimal' | 'correct' | 'wrong';
  punishers: PunishOption[];
  /** Fast enough, but can't reach after pushback at this spacing. */
  outOfRange: PunishOption[];
  /** Fast enough and in range, but they're intangible when it would hit (only with ctx.iframes). */
  intangible: PunishOption[];
  /** Punishes that start while the attacker's move is still active: 'beats' with invincibility, or may 'trade'. */
  lingering: Map<PunishOption, 'beats' | 'trade'>;
  best: PunishOption | null;
}

/** `choice === null` means the player answered "nothing punishes, it's safe". Without `ctx`, range is ignored. */
export function grade(options: PunishOption[], s: Situation, choice: PunishOption | null, ctx?: PunishContext): Grade {
  const punishers = options.filter((o) => punishes(o, s, ctx));
  const outOfRange = options.filter((o) => fastEnough(o, s) && !reaches(o, s, ctx));
  const intangible = options.filter((o) => fastEnough(o, s) && reaches(o, s, ctx) && intangibleAt(o, s, ctx));
  const linger = new Map<PunishOption, 'beats' | 'trade'>();
  for (const o of punishers) {
    const l = lingering(o, s, ctx);
    if (l) linger.set(o, l);
  }
  const best = punishers.reduce<PunishOption | null>((b, o) => (!b || o.reward > b.reward ? o : b), null);
  const base = { punishers, outOfRange, intangible, lingering: linger, best };

  if (choice === null) return { verdict: punishers.length === 0 ? 'optimal' : 'wrong', ...base };
  if (!punishes(choice, s, ctx)) return { verdict: 'wrong', ...base };
  return { verdict: best && choice.reward >= best.reward ? 'optimal' : 'correct', ...base };
}

export function pick<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** What the right answer to a situation is: the best punish's move name, or 'safe'. */
export const answerKey = (options: PunishOption[], s: Situation, ctx?: PunishContext) => grade(options, s, null, ctx).best?.move.name ?? 'safe';

/**
 * Groups situations by their right answer, so questions can be drawn evenly across answers.
 * Drawing situations uniformly would make one fast, high-damage move (Fox up smash, Puff Rest)
 * the answer to most questions, since most shielded moves leave a big window.
 */
export function bucketByAnswer(options: PunishOption[], pool: Situation[], ctx?: PunishContext): Situation[][] {
  return bucketBy(pool, (s) => answerKey(options, s, ctx));
}

/** Groups items by a key, keeping first-seen order. */
export function bucketBy<T>(items: T[], key: (item: T) => string): T[][] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = buckets.get(k);
    if (bucket) bucket.push(item);
    else buckets.set(k, [item]);
  }
  return [...buckets.values()];
}

/** Picks a bucket uniformly, then an item inside it. */
export const pickBalanced = <T>(buckets: T[][], rng: () => number = Math.random): T => pick(pick(buckets, rng), rng);
