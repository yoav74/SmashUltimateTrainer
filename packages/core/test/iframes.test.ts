import { describe, expect, it } from 'vitest';
import { attackerFrameAtPunish, grade, intangibleAt, lingering, type Character, type Move, type PunishOption, type Situation } from '../src/index.ts';

const move = (name: string, category: string, startup: number, extra: Partial<Move> = {}): Move => ({
  name, category, startup, totalFrames: null, landingLag: null, endlag: null, damage: [12], shieldAdvantage: [],
  raw: { startup: null, totalFrames: null, landingLag: null, activeFrames: null, damage: null, shieldStun: null, advantage: null },
  notes: null, hitboxGifs: [], ...extra,
});
const fighter = (moves: Move[]): Character => ({ slug: 'x', name: 'x', moves, oos: [], stats: {} });
const option = (m: Move, oosFrame: number, method: PunishOption['method'] = 'direct'): PunishOption => ({ move: m, oosFrame, method, reward: 10, travel: 0 });
const situation = (m: Move, extra: Partial<Situation> = {}): Situation => ({
  attacker: fighter([m]), move: m, hitbox: null, advantage: -30, damage: 10, shieldstun: 10, hitFrame: 10, lastActive: 12, ...extra,
});
const ctx = { spacing: 'off' as const, defender: fighter([]), iframes: true };

describe('attacker intangibility', () => {
  // Attacker hits shield on frame 10, shieldstun 10, so a frame-8 punish lands on their frame 28.
  const sneaky = move('Down B (Escape)', 'specialattacks', 10, { iframes: [{ kind: 'intangible', start: 25, end: 30, full: true }] });
  const usmash = option(move('Up Smash', 'groundattacks', 8), 8);
  const slow = option(move('Forward Smash', 'groundattacks', 15), 26, 'shield drop');

  it('times the punish against the attacker animation', () => {
    expect(attackerFrameAtPunish(usmash, situation(sneaky))).toBe(28);
  });
  it('fails a punish that lands while they are fully intangible', () => {
    expect(intangibleAt(usmash, situation(sneaky), ctx)).toEqual({ window: sneaky.iframes![0], frame: 28 });
    const g = grade([usmash, slow], situation(sneaky), usmash, ctx);
    expect(g.verdict).toBe('wrong');
    expect(g.intangible).toEqual([usmash]);
    expect(g.best).toBe(slow); // lands on frame 46, after the window
  });
  it('ignores partial-body windows and is off without ctx.iframes', () => {
    const legOnly = move('Up Smash', 'groundattacks', 10, { iframes: [{ kind: 'intangible', start: 25, end: 30, full: false, part: 'leg' }] });
    expect(intangibleAt(usmash, situation(legOnly), ctx)).toBeNull();
    expect(intangibleAt(usmash, situation(sneaky), { ...ctx, iframes: false })).toBeNull();
    expect(grade([usmash], situation(sneaky), usmash).verdict).not.toBe('wrong');
  });
  it('ignores intangibility on aerials, which land on shield first', () => {
    const fair = move('Forward Air', 'aerialattacks', 10, { iframes: [{ kind: 'intangible', start: 25, end: 30, full: true }] });
    expect(intangibleAt(usmash, situation(fair), ctx)).toBeNull();
  });
});

describe('lingering hitboxes', () => {
  // Still active until frame 25; you can act from frame 21 (10 + 10 + 1).
  const multihit = move('Down B (Spin)', 'specialattacks', 10, { notes: 'Hits every 4 frames.' });
  const s = situation(multihit, { lastActive: 25 });
  it('flags an option that starts while their hitbox is still out', () => {
    expect(lingering(option(move('Up Smash', 'groundattacks', 8), 8), s, ctx)).toBe('trade');
  });
  it('lets an option with invincibility over the exposed frames beat it (e.g. Corrin Up B)', () => {
    const corrinUpB = move('Up B (Dragon Ascent)', 'specialattacks', 18, { iframes: [{ kind: 'intangible', start: 1, end: 17, full: true }] });
    expect(lingering(option(corrinUpB, 18), s, ctx)).toBe('beats');
  });
  it('says nothing when the move is over before you can act', () => {
    expect(lingering(option(move('Up Smash', 'groundattacks', 8), 8), situation(multihit), ctx)).toBeNull();
  });
});

describe('lingering only applies to re-hitting moves', () => {
  it('ignores a single-hit move with late active frames (a move hits a target once)', () => {
    const fsmash = move('Forward Smash', 'groundattacks', 10);
    expect(lingering(option(move('Up Smash', 'groundattacks', 8), 8), situation(fsmash, { lastActive: 25 }), ctx)).toBeNull();
  });
});
