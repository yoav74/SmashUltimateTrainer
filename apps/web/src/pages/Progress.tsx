import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BOX_WAIT_MS, isDue, MASTERED, weakSpots, type CardState } from '@smash-trainer/core';
import { characterBySlug } from '@smash-trainer/data';
import { Portrait } from '../components/Media';
import { allCards, parseCardId, resetCards } from '../lib/srs';
import { allStats, resetStats } from '../lib/stats';

const nameOf = (slug: string) => characterBySlug.get(slug)?.name ?? slug;
const MODE_LABEL = { punish: 'Punish', safety: 'Is it safe?' };

function dueLabel(c: CardState, now: number): string {
  if (c.box === 0) return 'in a few questions';
  const wait = c.lastSeen + BOX_WAIT_MS[c.box] - now;
  if (wait <= 0) return 'due now';
  const h = wait / 3_600_000;
  return h < 1 ? `in ${Math.ceil(h * 60)} min` : h < 48 ? `in ${Math.round(h)} h` : `in ${Math.round(h / 24)} days`;
}

export function Progress() {
  const [version, setVersion] = useState(0); // bump to re-read storage after a reset
  const cards = allCards();
  const stats = allStats();
  const now = Date.now();
  const spots = weakSpots(cards);
  const mastered = cards.filter(([, c]) => c.box >= MASTERED).length;
  const due = cards.filter(([, c]) => isDue(c, now, Number.MAX_SAFE_INTEGER)).length;

  const matchups = stats
    .filter(([, , s]) => s.attempts > 0)
    .map(([you, opp, s]) => ({ you, opp, ...s, accuracy: s.correct / s.attempts }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

  const reset = () => {
    if (!window.confirm('Reset all your trainer progress in this browser? This cannot be undone.')) return;
    resetCards();
    resetStats();
    setVersion(version + 1);
  };

  if (!cards.length && !matchups.length) {
    return (
      <div>
        <h1>Progress</h1>
        <p className="muted">
          Nothing yet. Answer some questions in the <Link to="/train">Trainer</Link> and your weak spots will show up here. Questions you miss come back
          a few questions later, then after 10 minutes, a day, 3 days and a week, until you've got them down.
        </p>
      </div>
    );
  }

  return (
    <div className="progress-page">
      <h1>Progress</h1>
      <p className="muted small">Stored in this browser only.</p>

      <div className="detail-top">
        <div className="card mu-stat"><div className="mu-big">{spots.length}</div><div>weak spots</div></div>
        <div className="card mu-stat"><div className="mu-big">{due}</div><div>due for review now</div></div>
        <div className="card mu-stat"><div className="mu-big">{mastered}</div><div>mastered after a miss</div></div>
      </div>

      {spots.length > 0 && (
        <section>
          <h2>Weak spots</h2>
          <p className="muted small">Situations you've missed, worst first. They come back as "Review" questions in the trainer.</p>
          <div className="table-wrap">
            <table className="cards-on-mobile">
              <thead>
                <tr><th>Situation</th><th>Drill</th><th>Missed</th><th>Progress</th><th>Next review</th><th></th></tr>
              </thead>
              <tbody>
                {spots.slice(0, 40).map(([id, c]) => {
                  const k = parseCardId(id);
                  const verb = k.mode === 'punish' ? `${nameOf(k.opp)}'s` : 'your';
                  return (
                    <tr key={id}>
                      <td className="move-name">
                        <Portrait slug={k.mode === 'punish' ? k.opp : k.you} name="" size={28} /> {verb} <b>{k.move}</b>
                        {k.hitbox && <span className="muted small"> ({k.hitbox})</span>}
                        <span className="muted small">
                          {' '}· {nameOf(k.you)} vs {nameOf(k.opp)} · {k.spacing === 'off' ? 'frames only' : `${k.spacing} range`}
                        </span>
                      </td>
                      <td data-label="Drill">{MODE_LABEL[k.mode]}</td>
                      <td data-label="Missed">{c.misses}×</td>
                      <td data-label="Progress">
                        <span className="boxes" title={`Box ${c.box} of ${MASTERED}`}>
                          {Array.from({ length: MASTERED }, (_, i) => <i key={i} className={i < c.box ? 'on' : ''} />)}
                        </span>
                      </td>
                      <td data-label="Next review">{dueLabel(c, now)}</td>
                      <td data-label="">
                        <Link className="small" to={`/train?you=${k.you}&opp=${k.opp}${k.mode === 'safety' ? '&mode=safety' : ''}`}>Drill ▶</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {matchups.length > 0 && (
        <section>
          <h2>Matchups practiced</h2>
          <p className="muted small">Weakest first. Counts both drills.</p>
          <div className="table-wrap">
            <table className="cards-on-mobile">
              <thead>
                <tr><th>Matchup</th><th>Answered</th><th>Accuracy</th><th>Optimal</th><th></th></tr>
              </thead>
              <tbody>
                {matchups.map((m) => (
                  <tr key={m.you + m.opp}>
                    <td className="move-name">
                      <Link to={`/matchups/${m.you}/${m.opp}`}>{nameOf(m.you)} vs {nameOf(m.opp)}</Link>
                    </td>
                    <td data-label="Answered">{m.attempts}</td>
                    <td data-label="Accuracy" className={m.accuracy < 0.6 ? 'neg' : ''}>{Math.round(m.accuracy * 100)}%</td>
                    <td data-label="Optimal">{Math.round((m.optimal / m.attempts) * 100)}%</td>
                    <td data-label="">
                      <Link className="small" to={`/train?you=${m.you}&opp=${m.opp}`}>Drill ▶</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <button className="ghost small reset-btn" onClick={reset}>Reset progress</button>
    </div>
  );
}
