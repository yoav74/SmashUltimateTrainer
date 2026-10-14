// Spaced-repetition cards, kept in this browser only (like stats.ts).
import { answer, isDue, byUrgency, type CardState, type Situation, type Spacing } from '@smash-trainer/core';

export type DrillMode = 'punish' | 'safety';

export interface CardKey {
  mode: DrillMode;
  you: string;
  opp: string;
  move: string;
  hitbox: string | null;
  spacing: Spacing;
}

const KEY = 'smash-trainer:srs:v1';

interface Store {
  /** Total questions answered, across sessions (drives "come back after a few questions"). */
  count: number;
  cards: Record<string, CardState>;
}

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (s && typeof s.count === 'number' && s.cards) return s;
  } catch {}
  return { count: 0, cards: {} };
}

function save(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export const cardId = (k: CardKey) => [k.mode, k.you, k.opp, k.move, k.hitbox ?? '', k.spacing].join('|');

export function parseCardId(id: string): CardKey {
  const [mode, you, opp, move, hitbox, spacing] = id.split('|');
  return { mode: mode as DrillMode, you, opp, move, hitbox: hitbox || null, spacing: spacing as Spacing };
}

/** The card for a punish question (opp = attacker) or a safety question (opp = defender). */
export const cardFor = (mode: DrillMode, you: string, opp: string, s: Situation, spacing: Spacing): string =>
  cardId({ mode, you, opp, move: s.move.name, hitbox: s.hitbox, spacing });

export function recordCard(id: string, correct: boolean) {
  const s = load();
  s.count += 1;
  s.cards[id] = answer(s.cards[id], correct, Date.now(), s.count);
  save(s);
}

/** Card ids from `candidates` that are due for review now, most urgent first. */
export function dueCards(candidates: Iterable<string>): string[] {
  const s = load();
  const now = Date.now();
  const due: [string, CardState][] = [];
  for (const id of candidates) {
    const c = s.cards[id];
    if (c && isDue(c, now, s.count)) due.push([id, c]);
  }
  return due.sort(([, a], [, b]) => byUrgency(a, b)).map(([id]) => id);
}

export function allCards(): [string, CardState][] {
  return Object.entries(load().cards);
}

export function resetCards() {
  save({ count: 0, cards: {} });
}

/** Share of questions that are reviews when some are due (the rest are fresh questions). */
export const REVIEW_SHARE = 0.4;

/**
 * The next question: a due review (REVIEW_SHARE of the time, most urgent first) or a fresh one.
 * `avoid` keeps the current/upcoming question from being served twice in a row (fresh picks retry a few times).
 */
export function nextWithReviews<Q>(byId: Map<string, Q>, fresh: () => Q, idOf: (q: Q) => string, avoid: string[]): { q: Q; review: boolean } {
  const due = dueCards(byId.keys()).filter((id) => !avoid.includes(id));
  if (due.length && Math.random() < REVIEW_SHARE) return { q: byId.get(due[0])!, review: true };
  let q = fresh();
  for (let tries = 0; tries < 8 && avoid.includes(idOf(q)); tries++) q = fresh();
  return { q, review: false };
}
