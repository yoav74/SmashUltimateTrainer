import { useEffect, useMemo, useRef, useState } from 'react';
import { characterBySlug, characters } from '@smash-trainer/data';
import {
  intangibleAt,
  bucketBy,
  grade,
  pick,
  pickBalanced,
  punishOptions,
  reachNeeded,
  situationsFor,
  type Character,
  type Grade,
  type PunishOption,
  type Situation,
  type Spacing,
} from '@smash-trainer/core';
import { HitboxGif, Portrait, preloadImages } from '../components/Media';
import { recordResult } from '../lib/stats';
import { cardFor, nextWithReviews, recordCard } from '../lib/srs';

/** "You hit their shield with X. Is it safe?" The punish trainer with the roles swapped. */
interface SafetyQuestion {
  situation: Situation;
  defender: Character;
  spacing: Spacing;
  /** The defender's out-of-shield options, cached per defender. */
  options: PunishOption[];
}

const RANDOM = '__random__';

export function SafetySession({
  you,
  opp,
  spacing: spacingSetting,
  includeAerials,
  includeSpecials,
  onExit,
}: {
  you: Character;
  opp: string;
  spacing: Spacing | 'mixed';
  includeAerials: boolean;
  includeSpecials: boolean;
  onExit: () => void;
}) {
  // Grouped by spacing, then by answer (safe / punishable), so both answers come up about equally.
  const bySpacing = useMemo(() => {
    const defenders = opp === RANDOM ? characters.filter((c) => c.slug !== you.slug) : [characterBySlug.get(opp)!];
    const yourMoves = situationsFor(you, { includeAerials, includeSpecials });
    const spacings: Spacing[] = spacingSetting === 'mixed' ? ['close', 'max'] : [spacingSetting];
    return spacings.map((spacing) => {
      const questions = defenders.flatMap((defender) => {
        const options = punishOptions(defender);
        return yourMoves.map((situation) => ({ situation, defender, spacing, options }));
      });
      return bucketBy(questions, (q) => (isSafe(q) ? 'safe' : 'punishable'));
    });
  }, [you, opp, spacingSetting, includeAerials, includeSpecials]);

  const idOf = (q: SafetyQuestion) => cardFor('safety', you.slug, q.defender.slug, q.situation, q.spacing);
  const byId = useMemo(() => new Map(bySpacing.flat(2).map((q) => [idOf(q), q])), [bySpacing]);
  const nextQuestion = (avoid: string[] = []) => {
    const { q, review } = nextWithReviews(byId, () => pickBalanced(pick(bySpacing)), idOf, avoid);
    return { ...q, id: idOf(q), review };
  };
  const [question, setQuestion] = useState(() => nextQuestion());
  const [upcoming, setUpcoming] = useState(() => nextQuestion([question.id]));
  useEffect(() => preloadImages(upcoming.situation.move.hitboxGifs.slice(0, 1)), [upcoming]);
  const [answer, setAnswer] = useState<{ saidSafe: boolean; grade: Grade } | null>(null);
  const [session, setSession] = useState({ attempts: 0, correct: 0, streak: 0 });

  const { situation, defender, spacing } = question;

  const submit = (saidSafe: boolean) => {
    if (answer) return;
    const g = gradeQuestion(question);
    const ok = saidSafe === (g.best == null);
    setAnswer({ saidSafe, grade: g });
    recordResult(you.slug, defender.slug, ok ? 'optimal' : 'wrong');
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
      if (e.repeat) return;
      if (answer && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        next();
      } else if (!answer && (e.key === 's' || e.key === 'S')) submit(true);
      else if (!answer && (e.key === 'p' || e.key === 'P')) submit(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const safe = answer ? answer.grade.best == null : null;
  const correct = answer ? answer.saidSafe === safe : null;

  return (
    <div className="session">
      <div className="session-bar">
        <button className="ghost" onClick={onExit}>← Setup</button>
        <span>
          {session.correct}/{session.attempts} correct · streak {session.streak}
        </span>
        <span className="muted">Is it safe?</span>
      </div>

      <div className="prompt card">
        <div className="matchup">
          <span className="fighter"><Portrait slug={you.slug} name={you.name} size={44} /> <strong>{you.name}</strong></span>
          <span className="muted">hits</span>
          <span className="fighter"><Portrait slug={defender.slug} name={defender.name} size={44} /> <strong>{defender.name}'s</strong></span>
          <span className="muted">shield with</span>
        </div>
        <div className="move-title">
          {situation.move.name}
          {situation.hitbox && <span className="tag">{situation.hitbox} hit</span>}
          {question.review && <span className="tag review-tag">Review</span>}
          {spacing !== 'off' && <span className={`tag spacing-tag ${spacing}`}>{spacing === 'close' ? 'close range' : 'max range'}</span>}
        </div>
        <HitboxGif className="hitbox-main" src={situation.move.hitboxGifs[0]} alt={`${you.name} ${situation.move.name} hitbox`} />
        {answer && (
          <div className="adv">
            On shield: <b>{situation.advantage}</b>
            {reachNeeded(situation, { spacing, defender }) != null && <> · they need about <b>{reachNeeded(situation, { spacing, defender })!.toFixed(1)}</b> units of reach</>}
          </div>
        )}
        <h3>Is it safe?</h3>
        <div className="safety-buttons">
          <button className={`option big-choice ${answer ? (safe ? 'best' : answer.saidSafe ? 'bad' : 'dim') : ''}`} onClick={() => submit(true)}>
            <span className="opt-name">Safe</span> <kbd>S</kbd>
          </button>
          <button className={`option big-choice ${answer ? (!safe ? 'best' : !answer.saidSafe ? 'bad' : 'dim') : ''}`} onClick={() => submit(false)}>
            <span className="opt-name">Punishable</span> <kbd>P</kbd>
          </button>
        </div>
      </div>

      {answer && <button className="primary next-fab" onClick={next}>Next ▶</button>}
      {answer && <SafetyFeedback correct={!!correct} grade={answer.grade} situation={situation} defender={defender} spacing={spacing} onNext={next} />}
    </div>
  );
}

const gradeQuestion = (q: SafetyQuestion) => grade(q.options, q.situation, null, { spacing: q.spacing, defender: q.defender, iframes: true });
const isSafe = (q: SafetyQuestion) => gradeQuestion(q).best == null;

function SafetyFeedback({ correct, grade: g, situation, defender, spacing, onNext }: { correct: boolean; grade: Grade; situation: Situation; defender: Character; spacing: Spacing; onNext: () => void }) {
  const iframeHit = g.intangible[0] ? intangibleAt(g.intangible[0], situation, { spacing, defender, iframes: true }) : null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);
  return (
    <div ref={ref} className={`feedback card ${correct ? 'optimal' : 'wrong'}`}>
      <div className="feedback-head">
        <h3>{correct ? '✅ Correct' : '❌ Not quite'}</h3>
        <button className="primary next-btn" onClick={onNext}>
          Next ▶ <kbd>Enter</kbd> <kbd>Space</kbd>
        </button>
      </div>
      {g.best ? (
        <p>
          {defender.name} punishes with <b>{g.best.move.name}</b> (frame {g.best.oosFrame} out of shield, ~{g.best.reward}%)
          {g.punishers.length > 1 && <>, or {g.punishers.length - 1} other option{g.punishers.length > 2 ? 's' : ''}</>}. You're{' '}
          {-situation.advantage} frames behind.
        </p>
      ) : g.intangible.length ? (
        <p>
          Safe: you're intangible on frames {iframeHit!.window.start}–{iframeHit!.window.end} of {situation.move.name}, right when{' '}
          {defender.name}'s {g.intangible.map((o) => o.move.name).join(', ')} would hit.
        </p>
      ) : g.outOfRange.length ? (
        <p>
          Safe at this spacing: {defender.name}'s {g.outOfRange.map((o) => o.move.name).join(', ')} {g.outOfRange.length > 1 ? 'are' : 'is'} fast
          enough but can't reach after pushback.
        </p>
      ) : (
        <p>Safe: none of {defender.name}'s out-of-shield options come out within {-situation.advantage} frames.</p>
      )}
      {situation.move.notes && <p className="muted small">Move notes: {situation.move.notes}</p>}
    </div>
  );
}
