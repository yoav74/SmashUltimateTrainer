import { describe, expect, it } from 'vitest';
import { grade, punishOptions, situationsFor } from '@smash-trainer/core';
import { characterBySlug, characters, resourcesFor } from '../src/index.ts';

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
