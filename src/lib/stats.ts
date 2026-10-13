// Per-matchup trainer stats, kept in this browser only.
export interface MatchupStats {
  attempts: number;
  correct: number;
  optimal: number;
}

const KEY = 'smash-trainer:stats:v1';

function load(): Record<string, MatchupStats> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function getStats(you: string, opp: string): MatchupStats {
  return load()[`${you}|${opp}`] ?? { attempts: 0, correct: 0, optimal: 0 };
}

export function recordResult(you: string, opp: string, verdict: 'optimal' | 'correct' | 'wrong') {
  const all = load();
  const k = `${you}|${opp}`;
  const s = all[k] ?? { attempts: 0, correct: 0, optimal: 0 };
  s.attempts++;
  if (verdict !== 'wrong') s.correct++;
  if (verdict === 'optimal') s.optimal++;
  all[k] = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
