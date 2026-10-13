// Range model for punishes, built from public SmashWiki hitbox data.
//
// Exact where SmashWiki's data allows it (hitboxes anchored to the character's position: "top"/"trans"/"rot"),
// estimated otherwise (hitboxes on bones like arms, legs and swords: their real position depends on the
// animation, which isn't public). All the guessed constants live in ESTIMATE below so they're easy to tune.

export interface HitboxBox {
  kind: 'hit' | 'grab';
  id: number;
  damage: number | null;
  r: number;
  bone: string | null;
  x: [number, number];
  y: [number, number];
  z: [number, number];
  grounded: boolean;
  airborne: boolean;
}

export interface HitboxGroup {
  title: string;
  boxes: HitboxBox[];
}

export interface Reach {
  /** Forward reach in game units, measured from the character's position. */
  units: number;
  /** True when the farthest-reaching hitbox is anchored to the character's position, so the number comes straight from the data. */
  exact: boolean;
}

export const ESTIMATE = {
  /** How far a bone typically sits from the character's position, as a fraction of the fighter's size proxy. */
  boneDistance: [
    [/hand|arm|shoulder|claw|fist|finger|wrist|elbow/i, 0.6],
    [/haver|have|sword|knife|stick|hammer|cakram|whip|blade|weapon|clown|book|bat|racket|club|pan|sickle|umbrella|axe|pickaxe|key/i, 0.6],
    [/foot|leg|knee|toe|heel|thigh/i, 0.55],
    [/tail/i, 0.5],
    [/head|neck|ear|hair|mouth|jaw/i, 0.3],
    [/hip|waist|bust|body|center|spine|chest|belly|throw/i, 0.15],
  ] as [RegExp, number][],
  unknownBoneDistance: 0.45,
  /** Size proxy = standing grab reach, clamped so tether grabs (Lucas, Samus...) don't count as giant bodies. */
  sizeClamp: [9, 14] as [number, number],
  defaultSize: 11.5,
  /** Distance between two characters' positions when their bodies touch. */
  bodyGap: 8,
  /** Shield bubble radius, as a fraction of the defender's size proxy. */
  shieldRadius: 0.7,
  /** Half the width of the attacker's hurtbox, as a fraction of their size proxy. */
  hurtboxHalfWidth: 0.3,
  /** Dash attacks travel roughly this fraction of initial-dash speed per startup frame. */
  dashAttackTravel: 0.8,
  /** Below this, the hitbox is almost certainly positioned on a projectile, not the fighter. */
  minPlausibleReach: 4,
};

/** Tether grabs are separate objects in the hitbox data, so their reach can't be read from it. */
export const TETHER_GRABS = new Set(['samus', 'dark_samus', 'zero_suit_samus', 'pt_ivysaur', 'olimar', 'lucas', 'young_link', 'toon_link']);

const ANCHORED = /^(top|trans|rot)$/;

export const sizeProxy = (standingGrabReach: number | null) =>
  standingGrabReach == null
    ? ESTIMATE.defaultSize
    : Math.min(ESTIMATE.sizeClamp[1], Math.max(ESTIMATE.sizeClamp[0], standingGrabReach));

function boneDistance(bone: string): number {
  return ESTIMATE.boneDistance.find(([re]) => re.test(bone))?.[1] ?? ESTIMATE.unknownBoneDistance;
}

/** Reach of one hitbox in the direction the move attacks (forward, or backward for back moves), and whether it's exact. */
function boxReach(b: HitboxBox, size: number, backward: boolean): Reach {
  if (b.bone && ANCHORED.test(b.bone)) return { units: (backward ? -b.z[0] : b.z[1]) + b.r, exact: true };
  const maxAbs = (v: [number, number]) => Math.max(Math.abs(v[0]), Math.abs(v[1]));
  const offset = Math.hypot(maxAbs(b.x), maxAbs(b.y), maxAbs(b.z));
  return { units: boneDistance(b.bone ?? '') * size + offset + b.r, exact: false };
}

/**
 * A move's reach against a grounded target. Returns null when the data can't say (projectiles, whose
 * hitboxes are positioned relative to the projectile rather than the fighter).
 * - Grabs: only the standing-grab section, and only grabboxes that can catch grounded opponents.
 * - Back moves (back air): measured behind the character, since you turn around to use them.
 * - Only hitboxes dealing at least half the move's top damage count, so weak extras (Bayonetta's
 *   bullets, windboxes) don't stand in for the real hit.
 */
export function moveReach(groups: HitboxGroup[], size: number, opts: { grab?: boolean; backward?: boolean } = {}): Reach | null {
  let boxes: HitboxBox[];
  if (opts.grab) {
    const standing = groups.find((g) => /standing/i.test(g.title)) ?? groups.find((g) => g.boxes.some((b) => b.kind === 'grab'));
    boxes = (standing?.boxes ?? []).filter((b) => b.kind === 'grab' && b.grounded);
  } else {
    const hits = groups.flatMap((g) => g.boxes).filter((b) => b.kind === 'hit');
    const top = Math.max(0, ...hits.map((b) => b.damage ?? 0));
    boxes = hits.filter((b) => b.damage == null || b.damage >= top / 2);
  }
  const reaches = boxes.map((b) => boxReach(b, size, !!opts.backward)).filter((r) => r.units > 0);
  if (!reaches.length) return null;
  const best = reaches.reduce((a, b) => (b.units > a.units ? b : a));
  if (best.units < ESTIMATE.minPlausibleReach) return null;
  // Exact when the farthest-reaching hitbox is exact (shorter estimated ones don't change the answer).
  return { units: round1(best.units), exact: best.exact };
}

/** Which SmashWiki move page a UFD move name corresponds to (null for moves we can't map). */
export function wikiPageFor(moveName: string): string | null {
  const rules: [RegExp, string][] = [
    [/^Jab 1\b/, 'Neutral attack/Hit 1'],
    [/^Forward Tilt/, 'Forward tilt'],
    [/^Up Tilt/, 'Up tilt'],
    [/^Down Tilt/, 'Down tilt'],
    [/^Dash Attack/, 'Dash attack'],
    [/^Forward Smash/, 'Forward smash'],
    [/^Up Smash/, 'Up smash'],
    [/^Down Smash/, 'Down smash'],
    [/^Neutral Air/, 'Neutral aerial'],
    [/^Forward Air/, 'Forward aerial'],
    [/^Back Air/, 'Back aerial'],
    [/^Up Air/, 'Up aerial'],
    [/^Down Air/, 'Down aerial'],
    [/^Z Air/, 'Grab aerial'],
    [/^Neutral B\b/, 'Neutral special'],
    [/^Side B\b/, 'Side special'],
    [/^Up B\b/, 'Up special'],
    [/^Down B\b/, 'Down special'],
    [/^Grab$/, 'Grab'],
  ];
  return rules.find(([re]) => re.test(moveName))?.[1] ?? null;
}

/** Distance covered by an initial velocity that loses `decay` per frame (how shield pushback plays out). */
export function slideDistance(v0: number, decay: number): number {
  if (v0 <= 0 || decay <= 0) return 0;
  let d = 0;
  for (let v = v0; v > 0; v -= decay) d += v;
  return d;
}

/** Ultimate shield pushback (SmashWiki): defender (shieldstun + 1) × 0.09, max 1.3; attacker damage × 0.04 + 0.025 with 1.1× traction. */
export function pushback(opts: { shieldstun: number; damage: number; defenderTraction: number; attackerTraction: number }): number {
  const defender = slideDistance(Math.min(1.3, (opts.shieldstun + 1) * 0.09), opts.defenderTraction);
  const attacker = slideDistance(opts.damage * 0.04 + 0.025, opts.attackerTraction * 1.1);
  return round1(defender + attacker);
}

/** Ultimate shieldstun formula (damage × 0.8 + 2), used when UFD doesn't list shieldstun. */
export const shieldstunFromDamage = (damage: number) => Math.floor(damage * 0.8 + 2);

/** Horizontal distance an out-of-shield aerial drifts toward the opponent before its hitbox comes out. */
export function aerialDrift(frames: number, airSpeed: number, airAccel: number): number {
  let d = 0;
  for (let t = 1; t <= frames; t++) d += Math.min(airSpeed, airAccel * t);
  return round1(d);
}

export type Spacing = 'close' | 'max' | 'off';

/**
 * How far forward a punish must reach (from the defender's position) to hit the attacker's hurtbox.
 * close: the attacker hit your shield while standing next to you.
 * max:   the attacker's hitbox just touched the edge of your shield bubble.
 */
export function requiredReach(opts: {
  spacing: Exclude<Spacing, 'off'>;
  attackerReach: number | null;
  attackerSize: number;
  defenderSize: number;
  pushback: number;
}): number {
  const close = ESTIMATE.bodyGap;
  const max = opts.attackerReach == null ? close : Math.max(close, opts.attackerReach + ESTIMATE.shieldRadius * opts.defenderSize);
  const start = opts.spacing === 'max' ? max : close;
  return round1(start + opts.pushback - ESTIMATE.hurtboxHalfWidth * opts.attackerSize);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
