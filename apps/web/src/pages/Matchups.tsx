import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { punishOptions, punishTable, summarize, type Character, type PunishRow, type Spacing } from '@smash-trainer/core';
import { characterBySlug, fighterNumber, resourcesFor } from '@smash-trainer/data';
import { CharacterPicker } from '../components/CharacterPicker';
import { Portrait } from '../components/Media';

/** /matchups: pick two fighters. */
export function MatchupPicker() {
  const [you, setYou] = useState<string | null>(null);
  const [opp, setOpp] = useState<string | null>(null);
  const navigate = useNavigate();
  return (
    <div className="setup">
      <h1>Matchups</h1>
      <p className="muted">How each fighter punishes the other's shielded moves, at close or max range.</p>
      <section>
        <h2>1. Your fighter</h2>
        <CharacterPicker value={you} onChange={setYou} />
      </section>
      <section>
        <h2>2. Opponent</h2>
        <CharacterPicker value={opp} onChange={setOpp} />
      </section>
      <button className="primary big" disabled={!you || !opp} onClick={() => navigate(`/matchups/${you}/${opp}`)}>
        {you && opp ? `${characterBySlug.get(you)!.name} vs ${characterBySlug.get(opp)!.name}` : 'Pick both fighters'}
      </button>
    </div>
  );
}

const SPACINGS: { value: Spacing; label: string }[] = [
  { value: 'close', label: 'Close range' },
  { value: 'max', label: 'Max range' },
  { value: 'off', label: 'Frames only' },
];

/** /matchups/:you/:opp */
export function MatchupPage() {
  const { you: youSlug = '', opp: oppSlug = '' } = useParams();
  const you = characterBySlug.get(youSlug);
  const opp = characterBySlug.get(oppSlug);
  const [spacing, setSpacing] = useState<Spacing>('close');

  const theirMoves = useMemo(() => (you && opp ? punishTable(opp, you, spacing) : []), [you, opp, spacing]);
  const yourMoves = useMemo(() => (you && opp ? punishTable(you, opp, spacing) : []), [you, opp, spacing]);

  if (!you || !opp) return <p>Unknown matchup. <Link to="/matchups">Pick fighters</Link>.</p>;
  const theirs = summarize(theirMoves);
  const yours = summarize(yourMoves);

  return (
    <div className="matchup-page">
      <Link to="/matchups" className="ghost">← All matchups</Link>
      <header className="mu-header">
        <FighterHeader c={you} />
        <div className="mu-vs">
          <span>vs</span>
          <Link className="ghost small" to={`/matchups/${opp.slug}/${you.slug}`} title="Swap sides">⇄ swap</Link>
        </div>
        <FighterHeader c={opp} />
      </header>

      <div className="mu-actions">
        <div className="segmented" role="group" aria-label="Spacing">
          {SPACINGS.map((s) => (
            <button key={s.value} className={spacing === s.value ? 'on' : ''} aria-pressed={spacing === s.value} onClick={() => setSpacing(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="mu-train">
          <Link className="primary" to={`/?you=${you.slug}&opp=${opp.slug}`}>Drill punishes</Link>
          <Link className="ghost" to={`/?you=${you.slug}&opp=${opp.slug}&mode=safety`}>Drill "is it safe?"</Link>
        </div>
      </div>

      <div className="detail-top">
        <div className="card mu-stat">
          <div className="mu-big">{theirs.punishable}/{theirs.shielded}</div>
          <div>of {opp.name}'s shielded moves you can punish</div>
        </div>
        <div className="card mu-stat">
          <div className="mu-big">{yours.punishable}/{yours.shielded}</div>
          <div>of your shielded moves {opp.name} can punish</div>
        </div>
        <OosCompare you={you} opp={opp} />
        <StatsCompare you={you} opp={opp} />
      </div>

      <section>
        <h2>When {opp.name} hits your shield</h2>
        <PunishTable rows={theirMoves} defender={you} />
      </section>
      <section>
        <h2>When you hit {opp.name}'s shield</h2>
        <p className="muted small">Your moves that {opp.name} can punish are the ones to avoid throwing out carelessly.</p>
        <PunishTable rows={yourMoves} defender={opp} />
      </section>

      <p className="muted small">
        Frame data from ultimateframedata.com; reach and pushback from SmashWiki hitbox data (≈ = estimated). "Best" is the highest-damage
        punish that's fast enough and reaches.
      </p>
    </div>
  );
}

function FighterHeader({ c }: { c: Character }) {
  const discord = resourcesFor(c.slug).discords[0];
  return (
    <div className="mu-fighter">
      <Portrait slug={c.slug} name={c.name} size={88} />
      <div>
        <Link to={`/characters/${c.slug}`} className="mu-name">{c.name}</Link>
        <div className="muted small">#{fighterNumber(c.slug)}</div>
        {discord && <a className="small" href={discord.url} target="_blank" rel="noreferrer">Discord ↗</a>}
      </div>
    </div>
  );
}

function OosCompare({ you, opp }: { you: Character; opp: Character }) {
  const fastest = (c: Character) => punishOptions(c).slice(0, 3);
  return (
    <div className="card">
      <h3>Fastest out of shield</h3>
      <div className="mu-two">
        {[you, opp].map((c) => (
          <div key={c.slug}>
            <b>{c.name}</b>
            <ul className="plain small">
              {fastest(c).map((o) => (
                <li key={o.move.name}>F{o.oosFrame} {o.move.name}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const COMPARE_STATS = ['Weight', 'Run Speed', 'Air Speed', 'Fall Speed / Fast Fall Speed', 'Initial Dash'];

function StatsCompare({ you, opp }: { you: Character; opp: Character }) {
  return (
    <div className="card">
      <h3>Stats</h3>
      <table className="mu-stats">
        <thead>
          <tr><th></th><th>{you.name}</th><th>{opp.name}</th></tr>
        </thead>
        <tbody>
          {COMPARE_STATS.map((k) => (
            <tr key={k}>
              <td className="muted">{k.replace(' / Fast Fall Speed', ' / FF')}</td>
              <td>{you.stats[k] ?? '—'}</td>
              <td>{opp.stats[k] ?? '—'}</td>
            </tr>
          ))}
          <tr>
            <td className="muted">Traction</td>
            <td>{you.physics?.traction ?? '—'}</td>
            <td>{opp.physics?.traction ?? '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PunishTable({ rows, defender }: { rows: PunishRow[]; defender: Character }) {
  const [showSafe, setShowSafe] = useState(false);
  const shown = showSafe ? rows : rows.filter((r) => r.best || r.outOfRange.length);
  return (
    <>
      <div className="table-wrap">
        <table className="cards-on-mobile">
          <thead>
            <tr><th>Move</th><th>On shield</th><th>Best punish ({defender.name})</th><th>Also punishes</th><th>Fast enough but doesn't connect</th></tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.situation.move.name + (r.situation.hitbox ?? '') + i}>
                <td className="move-name">
                  {r.situation.move.name}
                  {r.situation.hitbox && <span className="muted small"> ({r.situation.hitbox})</span>}
                </td>
                <td data-label="On shield" className="neg">{r.situation.advantage}</td>
                <td data-label="Best punish">
                  {r.best ? (
                    <>
                      <b>{r.best.move.name}</b> <span className="muted small">F{r.best.oosFrame} · ~{r.best.reward}%</span>
                      {r.lingering.get(r.best) === 'trade' && <span className="warn small" title="The move keeps hitting while this starts"> · may trade</span>}
                      {r.lingering.get(r.best) === 'beats' && <span className="good small"> · invincible through it</span>}
                    </>
                  ) : (
                    <span className="muted">safe</span>
                  )}
                </td>
                <td data-label="Also punish" className="small">{r.punishers.filter((p) => p !== r.best).length || ''}</td>
                <td data-label="Doesn't connect" className="small muted">
                  {[...r.outOfRange.map((o) => `${o.move.name} (range)`), ...r.intangible.map((o) => `${o.move.name} (intangible)`)].join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="ghost small" onClick={() => setShowSafe(!showSafe)}>
        {showSafe ? 'Hide safe moves' : `Show all ${rows.length} moves, including safe ones`}
      </button>
    </>
  );
}
