import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { characterBySlug, characters } from '@smash-trainer/data';
import type { Character } from '@smash-trainer/core';
import { CharacterPicker, RANDOM } from '../components/CharacterPicker';
import { HitboxGif, Portrait, preloadImages } from '../components/Media';
import { bucketByAnswer, grade, pickBalanced, punishes, punishOptions, situationsFor, type Grade, type PunishOption, type Situation } from '@smash-trainer/core';
import { getStats, recordResult } from '../lib/stats';

interface Settings {
  includeAerials: boolean;
  includeSpecials: boolean;
  showFrames: boolean;
  showMoveGifs: boolean;
}

export function Trainer() {
  // Fighter pages link here as /?you=<slug>.
  const [params] = useSearchParams();
  const [you, setYou] = useState<string | null>(() => {
    const s = params.get('you');
    return s && characterBySlug.has(s) ? s : null;
  });
  const [opp, setOpp] = useState<string | null>(RANDOM);
  const [settings, setSettings] = useState<Settings>({ includeAerials: true, includeSpecials: true, showFrames: false, showMoveGifs: true });
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
        <label className="toggle">
          <input type="checkbox" checked={settings.showMoveGifs} onChange={(e) => setSettings({ ...settings, showMoveGifs: e.target.checked })} />
          Show hitbox GIFs on my options (heavier to load)
        </label>
      </section>

      <button className="primary big" disabled={!you || !opp} onClick={() => setRunning(true)}>
        {you ? `Start training as ${characterBySlug.get(you)!.name}` : 'Pick your fighter'}
      </button>
    </div>
  );
}

/**
 * Every shielded situation for the chosen opponent (or all fighters), grouped by right answer
 * so each possible answer comes up about equally often (see bucketByAnswer).
 */
function useQuestionBuckets(options: PunishOption[], opp: string, settings: Settings) {
  return useMemo(() => {
    const attackers = opp === RANDOM ? characters : [characterBySlug.get(opp)!];
    const pool = attackers.flatMap((a) => situationsFor(a, settings));
    if (!pool.length) throw new Error('No situations available with these filters');
    return bucketByAnswer(options, pool);
  }, [options, opp, settings.includeAerials, settings.includeSpecials]);
}

const METHOD_LABEL: Record<PunishOption['method'], string> = {
  'shield drop': `drop shield +11`,
  direct: 'straight from shield',
  jump: 'jump OoS +3',
  'shield grab': 'shield grab +4',
};

function Session({ you, opp, settings, onExit }: { you: Character; opp: string; settings: Settings; onExit: () => void }) {
  const options = useMemo(() => punishOptions(you), [you]);
  const buckets = useQuestionBuckets(options, opp, settings);
  const [situation, setSituation] = useState(() => pickBalanced(buckets));
  // The next question is picked ahead of time so its GIF can preload while you answer this one.
  const [upcoming, setUpcoming] = useState(() => pickBalanced(buckets));
  useEffect(() => preloadImages(upcoming.move.hitboxGifs.slice(0, 1)), [upcoming]);
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
    setSituation(upcoming);
    setUpcoming(pickBalanced(buckets));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answer && !e.repeat && (e.key === 'Enter' || e.key === ' ')) {
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
          <span className="fighter"><Portrait slug={you.slug} name={you.name} size={44} /> <strong>{you.name}</strong></span>
          <span className="muted">shields</span>
          <span className="fighter"><Portrait slug={situation.attacker.slug} name={situation.attacker.name} size={44} /> <strong>{situation.attacker.name}</strong></span>
        </div>
        <div className="move-title">
          {situation.move.name}
          {situation.hitbox && <span className="tag">{situation.hitbox} hit</span>}
        </div>
        <HitboxGif className="hitbox-main" src={gifs[0]} alt={`${situation.attacker.name} ${situation.move.name} hitbox`} />
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
              {settings.showMoveGifs && <HitboxGif className="opt-gif" lazy src={o.move.hitboxGifs[0]} alt={o.move.name} />}
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

      {answer && <Feedback answer={answer} situation={situation} fastest={options[0]?.oosFrame ?? null} onNext={next} />}
    </div>
  );
}

function Feedback({ answer, situation, fastest, onNext }: { answer: { choice: PunishOption | null; grade: Grade }; situation: Situation; fastest: number | null; onNext: () => void }) {
  const { verdict, punishers, best } = answer.grade;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);
  const window_ = -situation.advantage;
  const title = { optimal: '✅ Optimal!', correct: '👍 That punishes', wrong: '❌ Not quite' }[verdict];

  return (
    <div ref={ref} className={`feedback card ${verdict}`}>
      <div className="feedback-head">
        <h3>{title}</h3>
        <button className="primary next-btn" onClick={onNext}>
          Next ▶ <kbd>Enter</kbd> <kbd>Space</kbd>
        </button>
      </div>
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
      <p className="muted small">Damage figures are base values; spacing and range are not checked yet.</p>
      {situation.move.notes && <p className="muted small">Move notes: {situation.move.notes}</p>}
    </div>
  );
}
