import type { Invulnerability } from '@smash-trainer/core';

// Parses UFD move notes like these into windows:
//   "Intangible on frame 3-17"            → full intangibility 3–17
//   "Invulnerable on frame 7-17"          → full (invulnerable/invincible count as intangible)
//   "Intangibility on frames 1-9"         → full
//   "Leg intangibility on frame 12-17"    → partial (leg)
//   "Invulnerable on frame 4-6, 5-10 in the air" → ground 4–6, air 5–10
//   "Super armor on frame 8-13", "Damage based heavy armor (20%) frame 9-12" → armor
// Sentences with conditions we can't model ("after a successful grab", "when detecting") are skipped.

const KIND = /\b(intang\w*|invinc\w*|invul\w*|(?:super |heavy |damage[- ]based (?:heavy )?|belly |stone )?armou?r)\b/gi;
const BODY_PART = /\b(upper body|lower body|head|arms?|forearms?|legs?|feet|foot|ears?|chest|belly|tail|body)\b/i;
const CONDITIONAL = /after a successful|when detecting|if |counter freeze|added in \d/i;
const RANGE = /(\d+)\s*(?:[-—–]|to)\s*(\d+)|frames?\s+(\d+)(?!\s*[-—–\d])/gi;

function kindOf(word: string): Invulnerability['kind'] {
  return /armou?r/i.test(word) ? 'armor' : 'intangible';
}

export function parseInvulnerability(notes: string | null): Invulnerability[] {
  if (!notes) return [];
  const out: Invulnerability[] = [];
  // Split into sentences, then split sentences that mention two kinds ("Intangible frames 3—5, Super Armor frames 6—10").
  for (const sentence of notes.split(/(?<=\.)\s+|;\s*/)) {
    if (CONDITIONAL.test(sentence)) continue;
    const kinds = [...sentence.matchAll(KIND)];
    kinds.forEach((k, i) => {
      const clause = sentence.slice(k.index!, kinds[i + 1]?.index ?? sentence.length);
      const before = sentence.slice(i ? kinds[i - 1].index! + kinds[i - 1][0].length : 0, k.index!);
      const part = BODY_PART.exec(before)?.[0] ? before.trim().replace(/^and\s+/i, '').toLowerCase() : undefined;
      for (const r of clause.matchAll(RANGE)) {
        const start = parseInt(r[1] ?? r[3], 10);
        const end = parseInt(r[2] ?? r[3], 10);
        if (Number.isNaN(start) || end < start) continue;
        const after = clause.slice(r.index! + r[0].length, r.index! + r[0].length + 20);
        const only = /^\s*in the air/i.test(after) ? 'air' : /^\s*on the ground/i.test(after) ? 'ground' : undefined;
        out.push({
          kind: kindOf(k[0]),
          start,
          end,
          full: !part,
          ...(part ? { part: part.replace(/[^a-z /,]/g, '').trim() } : {}),
          ...(only ? { only } : {}),
        });
      }
    });
  }
  return out;
}
