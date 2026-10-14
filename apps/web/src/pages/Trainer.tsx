import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { characterBySlug, characters } from '@smash-trainer/data';
import {
  answerKey,
  bucketBy,
  fastEnough,
  grade,
  pick,
  pickBalanced,
  punishes,
  punishOptions,
  reachNeeded,
  situationsFor,
  type Character,
  type Grade,
  type PunishContext,
  type PunishOption,
  type Situation,
  type Spacing,
} from '@smash-trainer/core';
import { CharacterPicker, RANDOM } from '../components/CharacterPicker';
import { HitboxGif, Portrait, preloadImages } from '../components/Media';
import { getStats, recordResult } from '../lib/stats';
import { cardFor, nextWithReviews, recordCard } from '../lib/srs';
import { SafetySession } from './SafetyDrill';

type Mode = 'punish' | 'safety';
const MODES: Record<Mode, { title: string; help: string }> = {
  punish: { title: 'Punish', help: "Their move hits your shield. Pick the punish." },
  safety: { title: 'Is it safe?', help: "Your move hits their shield. Is it safe, or can they punish it?" },
};

/** 'mixed' gives each question close or max range at random, and says which. */
type TrainerSpacing = Spacing | 'mixed';

interface Settings {
  includeAerials: boolean;
  includeSpecials: boolean;
  showFrames: boolean;
  showMoveGifs: boolean;
  spacing: TrainerSpacing;
}

const SPACING_LABEL: Record<TrainerSpacing, { title: string; help: string }> = {
  close: { title: 'Close range', help: 'They hit your shield standing next to you. The usual punish scenario.' },
  max: { title: 'Max range', help: 'Their hitbox just touched the edge of your shield. Spaced moves are much safer.' },
  mixed: { title: 'Mixed', help: 'Each question is close or max range at random. Read the spacing tag before answering.' },
  off: { title: 'Ignore range', help: 'Frame data only, like before.' },
};

/** One question: a shielded move plus the spacing it hit your shield at. */
interface Question {
  situation: Situation;
  spacing: Spacing;
}

/** A question as served: plus its spaced-repetition card id and whether it came back as a review. */
interface Served extends Question {
  id: string;
  review: boolean;
}

export function Trainer() {
  // Fighter pages link here as /?you=<slug>.
  const [params] = useSearchParams();
  const [you, setYou] = useState<string | null>(() => {
    const s = params.get('you');
    return s && characterBySlug.has(s) ? s : null;
  });
  // Matchup pages link here as /?you=<slug>&opp=<slug>.
  const [opp, setOpp] = useState<string | null>(() => {
    const s = params.get('opp');
    return s && characterBySlug.has(s) ? s : RANDOM;
  });
  const [settings, setSettings] = useState<Settings>({
    includeAerials: true,
    includeSpecials: true,
    showFrames: false,
    showMoveGifs: true,
    spacing: 'close',
  });
  const [mode, setMode] = useState<Mode>(() => (params.get('mode') === 'safety' ? 'safety' : 'punish'));
  const [running, setRunning] = useState(false);

  if (running && you && opp) {
    const exit = () => setRunning(false);
    if (mode === 'safety') {
      return (
        <SafetySession
          you={characterBySlug.get(you)!}
          opp={opp}
          spacing={settings.spacing}
          includeAerials={settings.includeAerials}
          includeSpecials={settings.includeSpecials}
          onExit={exit}
        />
      );
    }
    return <Session you={characterBySlug.get(you)!} opp={opp} settings={settings} onExit={exit} />;
  }

  return (
    <div className="setup">
      <h1>Trainer</h1>
      <p className="muted">Answers use frame data plus each move's reach and shield pushback.</p>

      <div className="spacing-choice mode-choice">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <label key={m} className={`spacing-option ${mode === m ? 'on' : ''}`}>
            <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
            <b>{MODES[m].title}</b>
            <span className="muted small">{MODES[m].help}</span>
          </label>
        ))}
      </div>

      <section>
        <h2>1. Your fighter</h2>
        <CharacterPicker value={you} onChange={setYou} />
      </section>

      <section>
        <h2>2. Opponent</h2>
        <CharacterPicker value={opp} onChange={setOpp} allowRandom />
      </section>

      <section>
        <h2>3. Spacing</h2>
        <div className="spacing-choice">
          {(Object.keys(SPACING_LABEL) as TrainerSpacing[]).map((sp) => (
            <label key={sp} className={`spacing-option ${settings.spacing === sp ? 'on' : ''}`}>
              <input type="radio" name="spacing" checked={settings.spacing === sp} onChange={() => setSettings({ ...settings, spacing: sp })} />
              <b>{SPACING_LABEL[sp].title}</b>
              <span className="muted small">{SPACING_LABEL[sp].help}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2>4. Options</h2>
        <label className="toggle">
          <input type="checkbox" checked={settings.includeAerials} onChange={(e) => setSettings({ ...settings, includeAerials: e.target.checked })} />
          Include aerials (landing on shield)
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.includeSpecials} onChange={(e) => setSettings({ ...settings, includeSpecials: e.target.checked })} />
          Include specials
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.showFrames} onChange={(e) => setSettings({ ...settings, showFrames: e.target.checked })} />
          Show frame and reach hints before answering
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
 * Every shielded situation for the chosen opponent (or all fighters), per spacing in play, grouped by right
 * answer so each possible answer comes up about equally often (see bucketByAnswer). In Mixed mode the spacing
 * is picked 50/50 first; otherwise max range (where "safe" dominates) would crowd out close range.
 */
function useQuestionBuckets(options: PunishOption[], you: Character, opp: string, settings: Settings): Question[][][] {
  return useMemo(() => {
    const attackers = opp === RANDOM ? characters : [characterBySlug.get(opp)!];
    const situations = attackers.flatMap((a) => situationsFor(a, settings));
    if (!situations.length) throw new Error('No situations available with these filters');
    const spacings: Spacing[] = settings.spacing === 'mixed' ? ['close', 'max'] : [settings.spacing];
    return spacings.map((spacing) =>
      bucketBy(
        situations.map((situation) => ({ situation, spacing })),
        (q) => answerKey(options, q.situation, { spacing, defender: you }),
      ),
    );
  }, [options, you, opp, settings.includeAerials, settings.includeSpecials, settings.spacing]);
}

const METHOD_LABEL: Record<PunishOption['method'], string> = {
  'shield drop': `drop shield +11`,
  direct: 'straight from shield',
  jump: 'jump OoS +3',
  'shield grab': 'shield grab +4',
};

/** "14.8" for exact reach, "≈12" for estimates, null when unknown. */
function reachLabel(o: PunishOption): string | null {
  const r = o.move.reach;
  if (!r) return null;
  const total = r.units + o.travel;
  return r.exact && !o.travel ? total.toFixed(1) : `≈${Math.round(total)}`;
}

function Session({ you, opp, settings, onExit }: { you: Character; opp: string; settings: Settings; onExit: () => void }) {
  const options = useMemo(() => punishOptions(you), [you]);
  const bySpacing = useQuestionBuckets(options, you, opp, settings);
  const idOf = (q: Question) => cardFor('punish', you.slug, q.situation.attacker.slug, q.situation, q.spacing);
  // Every question in play by card id, so due reviews can be served from it.
  const byId = useMemo(() => new Map(bySpacing.flat(2).map((q) => [idOf(q), q])), [bySpacing]);
  const nextQuestion = (avoid: string[] = []): Served => {
    const { q, review } = nextWithReviews(byId, () => pickBalanced(pick(bySpacing)), idOf, avoid);
    return { ...q, id: idOf(q), review };
  };
  const [question, setQuestion] = useState(() => nextQuestion());
  // The next question is picked ahead of time so its GIF can preload while you answer this one.
  const [upcoming, setUpcoming] = useState(() => nextQuestion([question.id]));
  useEffect(() => preloadImages(upcoming.situation.move.hitboxGifs.slice(0, 1)), [upcoming]);
  const { situation, spacing } = question;
  const ctx = useMemo<PunishContext>(() => ({ spacing, defender: you }), [spacing, you]);
  const [answer, setAnswer] = useState<{ choice: PunishOption | null; grade: Grade } | null>(null);
  const [session, setSession] = useState({ attempts: 0, correct: 0, streak: 0 });

  const submit = (choice: PunishOption | null) => {
    if (answer) return;
    const g = grade(options, situation, choice, ctx);
    setAnswer({ choice, grade: g });
    recordResult(you.slug, situation.attacker.slug, g.verdict);
    const ok = g.verdict !== 'wrong';
    recordCard(question.id, ok);
    setSession((s) => ({ attempts: s.attempts + 1, correct: s.correct + (ok ? 1 : 0), streak: ok ? s.streak + 1 : 0 }));
  };

  const next = () => {
    setAnswer(null);
    setQuestion(upcoming);
    setUpcoming(nextQuestion([upcoming.id, question.id]));
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
  const needed = reachNeeded(situation, ctx);
  const mu = getStats(you.slug, situation.attacker.slug);
  const gifs = situation.move.hitboxGifs;
  const hints = settings.showFrames || !!answer;

  return (
    <div className="session">
      <div className="session-bar">
        <button className="ghost" onClick={onExit}>← Setup</button>
        <span>
          {session.correct}/{session.attempts} correct · streak {session.streak}
        </span>
        <span className="muted">
          {SPACING_LABEL[settings.spacing].title} · vs {situation.attacker.name} overall: {mu.correct}/{mu.attempts}
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
          {question.review && <span className="tag review-tag">Review</span>}
          {spacing !== 'off' && <span className={`tag spacing-tag ${spacing}`}>{SPACING_LABEL[spacing].title.toLowerCase()}</span>}
        </div>
        <HitboxGif className="hitbox-main" src={gifs[0]} alt={`${situation.attacker.name} ${situation.move.name} hitbox`} />
        {hints && (
          <div className="adv">
            On shield: <b>{situation.advantage}</b> → you have <b>{window_}</b> frames
            {needed != null && (
              <>
                {' '}and need about <b>{needed.toFixed(1)}</b> units of reach after pushback
              </>
            )}
          </div>
        )}
        <h3>What do you punish with?</h3>
      </div>

      <div className="options">
        {options.map((o) => {
          const outOfRange = answer?.grade.outOfRange.includes(o);
          const cls = !answer
            ? ''
            : o === answer.grade.best
              ? 'best'
              : punishes(o, situation, ctx)
                ? 'ok'
                : outOfRange
                  ? 'short'
                  : o === answer.choice
                    ? 'bad'
                    : 'dim';
          const reach = reachLabel(o);
          return (
            <button key={o.move.name} className={`option ${cls} ${o === answer?.choice ? 'chosen' : ''}`} onClick={() => submit(o)}>
              {settings.showMoveGifs && <HitboxGif className="opt-gif" lazy src={o.move.hitboxGifs[0]} alt={o.move.name} />}
              <span className="opt-name">{o.move.name}</span>
              {hints && (
                <span className="opt-frames">
                  F{o.oosFrame} <small>({METHOD_LABEL[o.method]})</small>
                  {spacing !== 'off' && <small> · reach {reach ?? '?'}</small>}
                </span>
              )}
              {outOfRange && <span className="opt-flag">out of range</span>}
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

      {answer && (
        <button className="primary next-fab" onClick={next}>Next ▶</button>
      )}
      {answer && (
        <Feedback answer={answer} situation={situation} needed={needed} fastest={options[0]?.oosFrame ?? null} onNext={next} />
      )}
    </div>
  );
}

function Feedback({
  answer,
  situation,
  needed,
  fastest,
  onNext,
}: {
  answer: { choice: PunishOption | null; grade: Grade };
  situation: Situation;
  needed: number | null;
  fastest: number | null;
  onNext: () => void;
}) {
  const { verdict, punishers, outOfRange, best } = answer.grade;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);
  const window_ = -situation.advantage;
  const title = { optimal: '✅ Optimal!', correct: '👍 That punishes', wrong: '❌ Not quite' }[verdict];
  const choice = answer.choice;

  return (
    <div ref={ref} className={`feedback card ${verdict}`}>
      <div className="feedback-head">
        <h3>{title}</h3>
        <button className="primary next-btn" onClick={onNext}>
          Next ▶ <kbd>Enter</kbd> <kbd>Space</kbd>
        </button>
      </div>
      {choice && !fastEnough(choice, situation) && (
        <p>
          {choice.move.name} comes out on frame {choice.oosFrame}, but you only have {window_} frames. {situation.attacker.name} can shield or act first.
        </p>
      )}
      {choice && outOfRange.includes(choice) && (
        <p>
          {choice.move.name} is fast enough, but after shield pushback you need about {needed?.toFixed(1)} units of reach and it only gets{' '}
          {reachLabel(choice)}. It would whiff.
        </p>
      )}
      {choice === null && punishers.length > 0 && <p>It's punishable: {punishers.length} of your options are fast enough and reach.</p>}
      {punishers.length === 0 ? (
        outOfRange.length ? (
          <p>
            Some options are fast enough ({outOfRange.map((o) => o.move.name).join(', ')}) but can't reach after pushback. Shield it and reset to neutral.
          </p>
        ) : (
          <p>None of your options are fast enough: your fastest is frame {fastest}. Shield it and reset to neutral.</p>
        )
      ) : (
        best && (
          <p>
            Highest-damage punish: <b>{best.move.name}</b> (frame {best.oosFrame}, ~{best.reward}%
            {best.method === 'shield grab' ? ' with your best throw' : ''}).
          </p>
        )
      )}
      <p className="muted small">
        Reach comes from SmashWiki hitbox data: exact numbers where the hitbox is anchored to the character, "≈" estimates for hitboxes on
        limbs and weapons. Units are game units.
      </p>
      {situation.move.notes && <p className="muted small">Move notes: {situation.move.notes}</p>}
    </div>
  );
}
