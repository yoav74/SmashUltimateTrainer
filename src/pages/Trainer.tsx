import { useEffect, useMemo, useState } from 'react';
import { characterBySlug, characters } from '../data/characters';
import type { Character } from '../data/types';
import { CharacterPicker, RANDOM } from '../components/CharacterPicker';
import { grade, pick, punishes, punishOptions, situationsFor, type Grade, type PunishOption, type Situation } from '../lib/punish';
import { getStats, recordResult } from '../lib/stats';

interface Settings {
  includeAerials: boolean;
  includeSpecials: boolean;
  showFrames: boolean;
}

export function Trainer() {
  const [you, setYou] = useState<string | null>(null);
  const [opp, setOpp] = useState<string | null>(RANDOM);
  const [settings, setSettings] = useState<Settings>({ includeAerials: true, includeSpecials: true, showFrames: false });
  const [running, setRunning] = useState(false);

  if (running && you && opp) {
    return <Session you={characterBySlug.get(you)!} opp={opp} settings={settings} onExit={() => setRunning(false)} />;
  }

  return (
    <div className="setup">
      <h1>Punish Trainer</h1>
      <p className="muted">
        The enemy's move hits your shield. Pick the punish. Answers come from frame data only, so they don't account for spacing yet.
      </p>

      <section>
        <h2>1. Your fighter</h2>
        <CharacterPicker value={you} onChange={setYou} />
      </section>

      <section>
        <h2>2. Opponent</h2>
        <CharacterPicker value={opp} onChange={setOpp} allowRandom />
      </section>

      <section>
        <h2>3. Options</h2>
        <label className="toggle">
          <input type="checkbox" checked={settings.includeAerials} onChange={(e) => setSettings({ ...settings, includeAerials: e.target.checked })} />
          Include enemy aerials (landing on shield)
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.includeSpecials} onChange={(e) => setSettings({ ...settings, includeSpecials: e.target.checked })} />
          Include enemy specials
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.showFrames} onChange={(e) => setSettings({ ...settings, showFrames: e.target.checked })} />
          Show frame hints before answering
        </label>
      </section>

      <button className="primary big" disabled={!you || !opp} onClick={() => setRunning(true)}>
        {you ? `Start training as ${characterBySlug.get(you)!.name}` : 'Pick your fighter'}
      </button>
    </div>
  );
}

function nextSituation(opp: string, settings: Settings): Situation {
  // Retry a few times in case a random fighter has no qualifying moves under the current filters.
  for (let i = 0; i < 20; i++) {
    const attacker: Character = opp === RANDOM ? pick(characters) : characterBySlug.get(opp)!;
    const pool = situationsFor(attacker, settings);
    if (pool.length) return pick(pool);
  }
  throw new Error('No situations available with these filters');
}

const METHOD_LABEL: Record<PunishOption['method'], string> = {
  'shield drop': `drop shield +11`,
  direct: 'straight from shield',
  jump: 'jump OoS +3',
  'shield grab': 'shield grab +4',
};

function Session({ you, opp, settings, onExit }: { you: Character; opp: string; settings: Settings; onExit: () => void }) {
  const options = useMemo(() => punishOptions(you), [you]);
  const [situation, setSituation] = useState(() => nextSituation(opp, settings));
  const [answer, setAnswer] = useState<{ choice: PunishOption | null; grade: Grade } | null>(null);
  const [session, setSession] = useState({ attempts: 0, correct: 0, streak: 0 });

  const submit = (choice: PunishOption | null) => {
    if (answer) return;
    const g = grade(options, situation, choice);
    setAnswer({ choice, grade: g });
    recordResult(you.slug, situation.attacker.slug, g.verdict);
    const ok = g.verdict !== 'wrong';
    setSession((s) => ({ attempts: s.attempts + 1, correct: s.correct + (ok ? 1 : 0), streak: ok ? s.streak + 1 : 0 }));
  };

  const next = () => {
    setAnswer(null);
    setSituation(nextSituation(opp, settings));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answer && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const window_ = -situation.advantage;
  const mu = getStats(you.slug, situation.attacker.slug);
  const gifs = situation.move.hitboxGifs;

  return (
    <div className="session">
      <div className="session-bar">
        <button className="ghost" onClick={onExit}>← Setup</button>
        <span>
          {session.correct}/{session.attempts} correct · streak {session.streak}
        </span>
        <span className="muted">
          vs {situation.attacker.name} overall: {mu.correct}/{mu.attempts}
        </span>
      </div>

      <div className="prompt card">
        <div className="matchup">
          <strong>{you.name}</strong> <span className="muted">shields</span> <strong>{situation.attacker.name}</strong>
        </div>
        <div className="move-title">
          {situation.move.name}
          {situation.hitbox && <span className="tag">{situation.hitbox} hit</span>}
        </div>
        {gifs.length > 0 && (
          <img className="hitbox-gif" src={gifs[0]} alt={`${situation.attacker.name} ${situation.move.name} hitbox`} loading="lazy" />
        )}
        {(settings.showFrames || answer) && (
          <div className="adv">
            On shield: <b>{situation.advantage}</b> → you have <b>{window_}</b> frames to land a hit
          </div>
        )}
        <h3>What do you punish with?</h3>
      </div>

      <div className="options">
        {options.map((o) => {
          const cls = !answer
            ? ''
            : o === answer.grade.best
              ? 'best'
              : punishes(o, situation)
                ? 'ok'
                : o === answer.choice
                  ? 'bad'
                  : 'dim';
          return (
            <button key={o.move.name} className={`option ${cls} ${o === answer?.choice ? 'chosen' : ''}`} onClick={() => submit(o)}>
              <span className="opt-name">{o.move.name}</span>
              {(settings.showFrames || answer) && (
                <span className="opt-frames">
                  F{o.oosFrame} <small>({METHOD_LABEL[o.method]})</small>
                </span>
              )}
            </button>
          );
        })}
        <button
          className={`option safe ${answer ? (answer.grade.punishers.length === 0 ? 'best' : answer.choice === null ? 'bad' : 'dim') : ''} ${answer && answer.choice === null ? 'chosen' : ''}`}
          onClick={() => submit(null)}
        >
          <span className="opt-name">Nothing, it's safe</span>
        </button>
      </div>

      {answer && <Feedback answer={answer} situation={situation} fastest={options[0]?.oosFrame ?? null} />}
    </div>
  );
}

function Feedback({ answer, situation, fastest }: { answer: { choice: PunishOption | null; grade: Grade }; situation: Situation; fastest: number | null }) {
  const { verdict, punishers, best } = answer.grade;
  const window_ = -situation.advantage;
  const title = { optimal: '✅ Optimal!', correct: '👍 That punishes', wrong: '❌ Not quite' }[verdict];

  return (
    <div className={`feedback card ${verdict}`}>
      <h3>{title}</h3>
      {answer.choice && !punishes(answer.choice, situation) && (
        <p>
          {answer.choice.move.name} comes out on frame {answer.choice.oosFrame}, but you only have {window_} frames. {situation.attacker.name} can
          shield or act first.
        </p>
      )}
      {answer.choice === null && punishers.length > 0 && <p>It's punishable: {punishers.length} of your options fit inside the {window_}-frame window.</p>}
      {punishers.length === 0 ? (
        <p>None of your options are fast enough: your fastest is frame {fastest}. Shield it and reset to neutral.</p>
      ) : (
        best && (
          <p>
            Highest-damage punish: <b>{best.move.name}</b> (frame {best.oosFrame}, ~{best.reward}%
            {best.method === 'shield grab' ? ' with your best throw' : ''}).
          </p>
        )
      )}
      <p className="muted small">Press Enter or Space for the next one. Damage figures are base values; spacing and range are not checked yet.</p>
      {situation.move.notes && <p className="muted small">Move notes: {situation.move.notes}</p>}
    </div>
  );
}
