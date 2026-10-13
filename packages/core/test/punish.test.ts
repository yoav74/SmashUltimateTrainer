import { describe, expect, it } from 'vitest';
import { answerKey, bucketByAnswer, grade, pickBalanced, punishes, punishOptions, situationsFor, type Character, type Move } from '../src/index.ts';

function move(name: string, category: string, startup: number | null, opts: Partial<Move> = {}): Move {
  return {
    name,
    category,
    startup,
    totalFrames: null,
    landingLag: null,
    endlag: null,
    damage: [10],
    shieldAdvantage: [],
    raw: { startup: null, totalFrames: null, landingLag: null, activeFrames: null, damage: null, shieldStun: null, advantage: null },
    notes: null,
    hitboxGifs: [],
    ...opts,
  };
}

const fighter = (slug: string, moves: Move[]): Character => ({ slug, name: slug, moves, oos: [], stats: {} });

const tester = fighter('tester', [
  move('Jab 1', 'groundattacks', 3),
  move('Jab 2', 'groundattacks', 2),
  move('Forward Tilt', 'groundattacks', 7, { damage: [11] }),
  move('Up Smash', 'groundattacks', 10, { damage: [16] }),
  move('Neutral Air', 'aerialattacks', 5),
  move('Up B (Rocket)', 'specialattacks', 4),
  move('Down B (Spin)', 'specialattacks', 6),
  move('Side B (Dash)', 'specialattacks', 12),
  move('Side B, Air (Dash, Air)', 'specialattacks', 20),
  move('Grab', 'grabs', 6, { damage: [] }),
  move('Forward Throw', 'grabs', 12, { damage: [9] }),
]);

const frameOf = (name: string, c = tester) => punishOptions(c).find((o) => o.move.name === name)?.oosFrame;

describe('punishOptions: out-of-shield rules', () => {
  it('adds 11 frames of shield drop to grounded moves', () => {
    expect(frameOf('Forward Tilt')).toBe(18);
  });
  it('lets Up B and Up Smash come out straight from shield', () => {
    expect(frameOf('Up B (Rocket)')).toBe(4);
    expect(frameOf('Up Smash')).toBe(10);
  });
  it('adds 3 frames of jumpsquat to aerials', () => {
    expect(frameOf('Neutral Air')).toBe(8);
  });
  it('adds 4 frames to shield grabs and rewards them with the best throw', () => {
    const grab = punishOptions(tester).find((o) => o.move.name === 'Grab');
    expect(grab?.oosFrame).toBe(10);
    expect(grab?.reward).toBe(9);
  });
  it('jumps out of shield for specials without a separate aerial version', () => {
    expect(frameOf('Down B (Spin)')).toBe(9);
  });
  it('uses the aerial version of a special when one is listed, and shield drop for the grounded one', () => {
    expect(frameOf('Side B, Air (Dash, Air)')).toBe(23);
    expect(frameOf('Side B (Dash)')).toBe(23);
  });
  it('skips jab follow-ups', () => {
    expect(frameOf('Jab 2')).toBeUndefined();
  });
  it('honours per-character jumpsquat (Kazuya: 7)', () => {
    const kazuya = fighter('kazuya', [move('Up Air', 'aerialattacks', 4)]);
    expect(frameOf('Up Air', kazuya)).toBe(11);
  });
});

describe('grade', () => {
  const attacker = fighter('attacker', [
    move('Forward Smash', 'groundattacks', 15, { shieldAdvantage: [{ value: -18, hitbox: null }] }),
    move('Forward Air', 'aerialattacks', 8, { shieldAdvantage: [{ value: -3, hitbox: null }] }),
  ]);
  const [fsmash, fair] = situationsFor(attacker, { includeAerials: true, includeSpecials: true });
  const options = punishOptions(tester);
  const opt = (name: string) => options.find((o) => o.move.name === name)!;

  it('counts an option that comes out exactly on the last frame of the window', () => {
    expect(punishes(opt('Forward Tilt'), fsmash)).toBe(true); // F18 vs -18
  });
  it('marks the highest-reward punish as optimal and other punishes as correct', () => {
    expect(grade(options, fsmash, opt('Up Smash')).verdict).toBe('optimal');
    expect(grade(options, fsmash, opt('Neutral Air')).verdict).toBe('correct');
  });
  it('marks a too-slow option as wrong', () => {
    expect(grade(options, fair, opt('Neutral Air')).verdict).toBe('wrong');
  });
  it('accepts "nothing, it\'s safe" only when nothing punishes', () => {
    expect(grade(options, fair, null).verdict).toBe('optimal');
    expect(grade(options, fsmash, null).verdict).toBe('wrong');
  });
});

describe('balanced question picking', () => {
  // Ten big-window moves (Up Smash is always the answer) and one tight one (nothing punishes).
  const attacker = fighter('attacker', [
    ...Array.from({ length: 10 }, (_, i) => move(`Smash ${i}`, 'groundattacks', 15, { shieldAdvantage: [{ value: -25, hitbox: null }] })),
    move('Jab 1', 'groundattacks', 3, { shieldAdvantage: [{ value: -2, hitbox: null }] }),
  ]);
  const pool = situationsFor(attacker, { includeAerials: true, includeSpecials: true });
  const options = punishOptions(tester);

  it('groups situations by their answer', () => {
    const buckets = bucketByAnswer(options, pool);
    expect(buckets.map((b) => answerKey(options, b[0])).sort()).toEqual(['Up Smash', 'safe']);
  });

  it('draws each answer about equally often, not in proportion to how many situations share it', () => {
    const buckets = bucketByAnswer(options, pool);
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const safe = Array.from({ length: 2000 }, () => pickBalanced(buckets, rng)).filter((s) => answerKey(options, s) === 'safe').length;
    expect(safe / 2000).toBeGreaterThan(0.4); // uniform drawing would give ~1/11
    expect(safe / 2000).toBeLessThan(0.6);
  });
});
