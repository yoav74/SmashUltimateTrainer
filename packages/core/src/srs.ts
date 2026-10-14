// Spaced repetition (Leitner boxes) for trainer questions.
// A miss sends a card back to box 0; each correct answer moves it up a box, and higher boxes wait longer.

export interface CardState {
  /** 0 = just missed ... MASTERED = learned. */
  box: number;
  correct: number;
  misses: number;
  /** When it was last answered (ms since epoch). */
  lastSeen: number;
  /** Question counter value when it was last answered, for "come back a few questions later". */
  lastSeenAt: number;
}

export const MASTERED = 5;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** How long a card waits in each box before it's due again. Box 0 waits a few questions instead (see REQUEUE_AFTER). */
export const BOX_WAIT_MS = [0, 10 * MIN, DAY, 3 * DAY, 7 * DAY];
/** A missed card comes back after this many other questions in the same session. */
export const REQUEUE_AFTER = 3;

export function answer(state: CardState | undefined, correct: boolean, now: number, questionCount: number): CardState {
  const s = state ?? { box: 0, correct: 0, misses: 0, lastSeen: 0, lastSeenAt: 0 };
  return {
    box: correct ? Math.min(MASTERED, s.box + 1) : 0,
    correct: s.correct + (correct ? 1 : 0),
    misses: s.misses + (correct ? 0 : 1),
    lastSeen: now,
    lastSeenAt: questionCount,
  };
}

/** Due when it has been missed before (or isn't learned yet) and its box's wait is over. */
export function isDue(s: CardState, now: number, questionCount: number): boolean {
  if (s.misses === 0 || s.box >= MASTERED) return false;
  if (s.box === 0) return questionCount - s.lastSeenAt >= REQUEUE_AFTER || now - s.lastSeen > 10 * MIN;
  return now - s.lastSeen >= BOX_WAIT_MS[s.box];
}

/** Most urgent first: lowest box, then most misses, then least recently seen. */
export function byUrgency(a: CardState, b: CardState): number {
  return a.box - b.box || b.misses - a.misses || a.lastSeen - b.lastSeen;
}

/** Weak spots: cards missed at least once and not yet mastered, worst first. */
export function weakSpots<K>(cards: [K, CardState][]): [K, CardState][] {
  return cards.filter(([, s]) => s.misses > 0 && s.box < MASTERED).sort(([, a], [, b]) => byUrgency(a, b));
}
