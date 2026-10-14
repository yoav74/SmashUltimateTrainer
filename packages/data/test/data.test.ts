import { describe, expect, it } from 'vitest';
import { grade, punishOptions, punishTable, situationsFor, summarize } from '@smash-trainer/core';
import { characterBySlug, characters, fighterNumber, fighterOrder, parseInvulnerability, resourcesFor } from '../src/index.ts';

const get = (slug: string) => {
  const c = characterBySlug.get(slug);
  if (!c) throw new Error(`missing fighter ${slug}`);
  return c;
};

describe('scraped frame data', () => {
  it('has all 89 fighters, each with moves', () => {
    expect(characters).toHaveLength(89);
    for (const c of characters) expect(c.moves.length, c.slug).toBeGreaterThan(20);
  });

  it("keeps Kazuya's ground attacks (UFD splits them into sub-sections)", () => {
    const ground = get('kazuya').moves.filter((m) => m.category === 'groundattacks');
    expect(ground.length).toBeGreaterThanOrEqual(30);
  });
});

describe('punish engine on real data', () => {
  it('Lucas forward tilt punishes Kirby forward smash', () => {
    const lucas = get('lucas');
    const fsmash = situationsFor(get('kirby'), { includeAerials: true, includeSpecials: true }).find(
      (s) => s.move.name === 'Forward Smash',
    )!;
    const ftilt = punishOptions(lucas).find((o) => o.move.name === 'Forward Tilt')!;
    expect(fsmash.advantage).toBe(-23);
    expect(ftilt.oosFrame).toBe(18);
    expect(grade(punishOptions(lucas), fsmash, ftilt).verdict).not.toBe('wrong');
  });

  it("Jigglypuff's fastest OoS is Rest at frame 5", () => {
    const fastest = punishOptions(get('jigglypuff'))[0];
    expect(fastest.move.name).toMatch(/Rest/);
    expect(fastest.oosFrame).toBe(5);
  });

  it("matches UFD's hand-curated fastest OoS for at least 79 fighters", () => {
    const withList = characters.filter((c) => c.oos.length);
    const matching = withList.filter((c) => punishOptions(c)[0]?.oosFrame === Math.min(...c.oos.map((o) => o.frame)));
    const mismatched = withList.filter((c) => !matching.includes(c)).map((c) => c.slug);
    // Known differences: Mii customs, items, grab missing from UFD's list (see README).
    expect(matching.length, `mismatched: ${mismatched.join(', ')}`).toBeGreaterThanOrEqual(79);
  });
});

describe('community resources', () => {
  it('has a verified Discord for almost every fighter', () => {
    const withDiscord = characters.filter((c) => resourcesFor(c.slug).discords.length);
    expect(withDiscord.length).toBeGreaterThanOrEqual(85);
  });
  it("links Lucas's Sunflower Field resource sheet", () => {
    expect(resourcesFor('lucas').links.some((l) => l.url.includes('1lCVfUxWdrXDzIJBMYjvxPhJQ4FI0w-owyZkFcIPjUFE'))).toBe(true);
  });
});

describe('fighter numbers', () => {
  it('has an official number for every fighter, with no duplicates', () => {
    const numbers = characters.map((c) => fighterNumber(c.slug));
    expect(numbers.filter((n) => n === null)).toEqual([]);
    expect(new Set(numbers).size).toBe(characters.length);
  });
  it('sorts echoes right after their base fighter', () => {
    const order = [...characters].sort((a, b) => fighterOrder(a.slug) - fighterOrder(b.slug)).map((c) => c.slug);
    expect(order.slice(0, 4)).toEqual(['mario', 'donkey_kong', 'link', 'samus']);
    expect(order.indexOf('daisy')).toBe(order.indexOf('peach') + 1);
    expect(order[order.length - 1]).toBe('sora');
  });
});

describe('reach from SmashWiki hitbox data', () => {
  it('has hitbox data and physics for every fighter', () => {
    expect(characters.filter((c) => !c.physics).map((c) => c.slug)).toEqual([]);
  });
  it("computes Lucas forward tilt's reach exactly", () => {
    expect(get('lucas').moves.find((m) => m.name === 'Forward Tilt')?.reach).toEqual({ units: 14.8, exact: true });
  });
  it("computes Pikachu's standing grab exactly", () => {
    expect(get('pikachu').moves.find((m) => m.name === 'Grab')?.reach).toEqual({ units: 11.9, exact: true });
  });
  it('leaves tether grabs unknown instead of guessing', () => {
    expect(get('lucas').moves.find((m) => m.name === 'Grab')?.reach).toBeUndefined();
  });
  it('still lets Lucas forward tilt punish Kirby forward smash up close', () => {
    const lucas = get('lucas');
    const s = situationsFor(get('kirby'), { includeAerials: true, includeSpecials: true }).find((x) => x.move.name === 'Forward Smash')!;
    const ftilt = punishOptions(lucas).find((o) => o.move.name === 'Forward Tilt')!;
    expect(grade(punishOptions(lucas), s, ftilt, { spacing: 'close', defender: lucas }).verdict).not.toBe('wrong');
  });
});

describe('matchup tables', () => {
  it('lists the attacker\'s shielded moves, most punishable first, with the defender\'s punishes', () => {
    const rows = punishTable(get('kirby'), get('lucas'), 'close');
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0].situation.advantage).toBeLessThanOrEqual(rows[rows.length - 1].situation.advantage);
    expect(rows.find((r) => r.situation.move.name === 'Forward Smash')?.punishers.some((p) => p.move.name === 'Forward Tilt')).toBe(true);
    const close = summarize(rows), max = summarize(punishTable(get('kirby'), get('lucas'), 'max'));
    expect(max.punishable).toBeLessThanOrEqual(close.punishable);
  });
});

describe('i-frames parsed from UFD notes', () => {
  const move = (slug: string, name: string) => get(slug).moves.find((m) => m.name === name)!;
  it("Lucas's PK Thunder self-hit is intangible on frames 1-9", () => {
    expect(move('lucas', 'Up B, Self-hit (PK Thunder 2)').iframes).toEqual([{ kind: 'intangible', start: 1, end: 9, full: true }]);
  });
  it("Corrin's Up B is invulnerable on frames 7-17", () => {
    expect(move('corrin', 'Up B (Dragon Ascent)').iframes).toEqual([{ kind: 'intangible', start: 7, end: 17, full: true }]);
  });
  it("Kirby's up smash only has leg intangibility (partial, not full body)", () => {
    expect(move('kirby', 'Up Smash').iframes).toEqual([{ kind: 'intangible', start: 12, end: 17, full: false, part: 'leg' }]);
  });
  it('flags armor separately and skips conditional notes', () => {
    expect(parseInvulnerability('Intangible frames 3—5, Super Armor frames 6—10.')).toEqual([
      { kind: 'intangible', start: 3, end: 5, full: true },
      { kind: 'armor', start: 6, end: 10, full: true },
    ]);
    expect(parseInvulnerability('Invulnerable on frame 4-6, 5-10 in the air.')[1]).toMatchObject({ start: 5, end: 10, only: 'air' });
    expect(parseInvulnerability('23 frames of invulnerability after a successful grab.')).toEqual([]);
    expect(parseInvulnerability('Intangibility on 5-6 when detecting.')).toEqual([]);
  });
});
