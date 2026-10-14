import { describe, expect, it } from 'vitest';
import {
  grade,
  moveReach,
  pushback,
  requiredReach,
  slideDistance,
  ESTIMATE,
  type Character,
  type HitboxBox,
  type Move,
  wikiPageFor,
} from '../src/index.ts';

const box = (b: Partial<HitboxBox>): HitboxBox => ({
  kind: 'hit', id: 0, damage: 10, r: 3, bone: 'top', x: [0, 0], y: [5, 5], z: [8, 8], grounded: true, airborne: true, ...b,
});

describe('moveReach', () => {
  it('is exact for hitboxes anchored to the character (offset + radius)', () => {
    expect(moveReach([{ title: '', boxes: [box({ z: [8.5, 8.5], r: 5.6 })] }], 12)).toEqual({ units: 14.1, exact: true });
  });
  it('estimates hitboxes on bones and flags them as estimates', () => {
    const r = moveReach([{ title: '', boxes: [box({ bone: 'footl', z: [0, 0], r: 4 })] }], 10)!;
    expect(r.exact).toBe(false);
    expect(r.units).toBeCloseTo(0.55 * 10 + Math.hypot(0, 5, 0) + 4, 1);
  });
  it('measures back moves behind the character', () => {
    expect(moveReach([{ title: '', boxes: [box({ z: [-12, -6], r: 3 })] }], 12, { backward: true })?.units).toBe(15);
  });
  it('ignores weak extra hitboxes that would overstate reach', () => {
    const groups = [{ title: '', boxes: [box({ z: [10, 10], damage: 14 }), box({ z: [60, 60], damage: 1 })] }];
    expect(moveReach(groups, 12)?.units).toBe(13);
  });
  it('returns null for projectile-positioned hitboxes', () => {
    expect(moveReach([{ title: '', boxes: [box({ z: [0, 0], r: 2 })] }], 12)).toBeNull();
  });
  it('uses only the standing grab, and only grabboxes that catch grounded opponents', () => {
    const groups = [
      { title: 'Standing Grab', boxes: [box({ kind: 'grab', z: [4.9, 7.9], r: 4 }), box({ kind: 'grab', z: [2.9, 12], r: 2, grounded: false })] },
      { title: 'Dash Grab', boxes: [box({ kind: 'grab', z: [4, 20], r: 2.5 })] },
    ];
    expect(moveReach(groups, 12, { grab: true })).toEqual({ units: 11.9, exact: true });
  });
});

describe('shield pushback', () => {
  it('slides until traction stops it', () => {
    expect(slideDistance(1, 0.25)).toBeCloseTo(1 + 0.75 + 0.5 + 0.25);
    expect(slideDistance(0, 0.1)).toBe(0);
  });
  it('caps defender pushback at 1.3 initial speed', () => {
    const huge = pushback({ shieldstun: 100, damage: 0, defenderTraction: 0.1, attackerTraction: 0.1 });
    expect(huge).toBeCloseTo(slideDistance(1.3, 0.1) + slideDistance(0.025, 0.11), 1);
  });
});

describe('requiredReach', () => {
  it('needs more reach at max range than up close', () => {
    const base = { attackerReach: 15, attackerSize: 12, defenderSize: 12, pushback: 5 };
    const close = requiredReach({ spacing: 'close', ...base });
    const max = requiredReach({ spacing: 'max', ...base });
    expect(close).toBeCloseTo(ESTIMATE.bodyGap + 5 - ESTIMATE.hurtboxHalfWidth * 12, 1);
    expect(max).toBeGreaterThan(close);
  });
});

describe('grade with range', () => {
  const physics = { traction: 0.11, size: 12, airSpeed: 1, airAccel: 0.08, initialDash: 1.8 };
  const move = (name: string, category: string, startup: number, extra: Partial<Move> = {}): Move => ({
    name, category, startup, totalFrames: null, landingLag: null, endlag: null, damage: [12], shieldAdvantage: [],
    raw: { startup: null, totalFrames: null, landingLag: null, activeFrames: null, damage: null, shieldStun: null, advantage: null },
    notes: null, hitboxGifs: [], ...extra,
  });
  const defender: Character = {
    slug: 'd', name: 'd', oos: [], stats: {}, physics,
    moves: [move('Up Smash', 'groundattacks', 8, { reach: { units: 6, exact: true } }), move('Forward Tilt', 'groundattacks', 6, { reach: { units: 30, exact: true } })],
  };
  const attacker: Character = { slug: 'a', name: 'a', oos: [], stats: {}, physics, moves: [] };
  const s = { attacker, move: move('Forward Smash', 'groundattacks', 15, { reach: { units: 15, exact: true } }), hitbox: null, advantage: -25, damage: 15, shieldstun: 14, hitFrame: 15, lastActive: 17 };

  it('ignores range when no context is given (frame-only, as before)', () => {
    expect(grade([], s, null).verdict).toBe('optimal');
  });
  it('marks fast-but-short options as out of range', () => {
    const opts = [
      { move: defender.moves[0], oosFrame: 8, method: 'direct' as const, reward: 16, travel: 0 },
      { move: defender.moves[1], oosFrame: 17, method: 'shield drop' as const, reward: 12, travel: 0 },
    ];
    const g = grade(opts, s, opts[0], { spacing: 'close', defender });
    expect(g.verdict).toBe('wrong');
    expect(g.outOfRange.map((o) => o.move.name)).toEqual(['Up Smash']);
    expect(g.best?.move.name).toBe('Forward Tilt');
  });
});

describe('wikiPageFor', () => {
  it('maps UFD move names to SmashWiki pages, without confusing air dodges for aerials', () => {
    expect(wikiPageFor('Neutral Air')).toBe('Neutral aerial');
    expect(wikiPageFor('Neutral Air Dodge')).toBeNull();
    expect(wikiPageFor('Up B (PK Thunder)')).toBe('Up special');
    expect(wikiPageFor('Grab')).toBe('Grab');
    expect(wikiPageFor('Dash Grab')).toBeNull();
  });
});
