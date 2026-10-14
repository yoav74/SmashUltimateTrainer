import { describe, expect, it } from 'vitest';
import { answer, BOX_WAIT_MS, isDue, MASTERED, REQUEUE_AFTER, weakSpots } from '../src/index.ts';

const t0 = 1_000_000_000_000;

describe('spaced repetition', () => {
  it('sends a missed card back to box 0 and counts the miss', () => {
    const s = answer(answer(undefined, true, t0, 1), false, t0, 2);
    expect(s).toMatchObject({ box: 0, correct: 1, misses: 1, lastSeenAt: 2 });
  });

  it('brings a missed card back after a few other questions', () => {
    const s = answer(undefined, false, t0, 10);
    expect(isDue(s, t0, 10 + REQUEUE_AFTER - 1)).toBe(false);
    expect(isDue(s, t0, 10 + REQUEUE_AFTER)).toBe(true);
  });

  it('waits longer in higher boxes', () => {
    let s = answer(undefined, false, t0, 1);
    s = answer(s, true, t0, 5); // box 1
    expect(isDue(s, t0 + BOX_WAIT_MS[1] - 1, 6)).toBe(false);
    expect(isDue(s, t0 + BOX_WAIT_MS[1], 6)).toBe(true);
    s = answer(s, true, t0, 7); // box 2
    expect(isDue(s, t0 + BOX_WAIT_MS[1], 8)).toBe(false);
  });

  it('never schedules cards that were never missed, or mastered ones', () => {
    expect(isDue(answer(undefined, true, t0, 1), t0 + 1e12, 999)).toBe(false);
    let s = answer(undefined, false, t0, 1);
    for (let i = 0; i < MASTERED; i++) s = answer(s, true, t0, 2 + i);
    expect(s.box).toBe(MASTERED);
    expect(isDue(s, t0 + 1e12, 999)).toBe(false);
  });

  it('lists weak spots worst first', () => {
    const missedTwice = answer(answer(undefined, false, t0, 1), false, t0, 2);
    const missedOnceThenRight = answer(answer(undefined, false, t0, 1), true, t0, 2);
    const neverMissed = answer(undefined, true, t0, 1);
    const spots = weakSpots([['a', missedOnceThenRight], ['b', missedTwice], ['c', neverMissed]]);
    expect(spots.map(([k]) => k)).toEqual(['b', 'a']);
  });
});
