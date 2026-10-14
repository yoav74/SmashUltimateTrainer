import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isDue, weakSpots } from '@smash-trainer/core';
import { characterBySlug, characters } from '@smash-trainer/data';
import { CharacterPicker } from '../components/CharacterPicker';
import { Portrait } from '../components/Media';
import { sortFighters, useFighterSort } from '../lib/fighterSort';
import { allCards, parseCardId } from '../lib/srs';

const MAIN_KEY = 'smash-trainer:main';

function readMain(): string | null {
  try {
    const s = localStorage.getItem(MAIN_KEY);
    return s && characterBySlug.has(s) ? s : null;
  } catch {
    return null;
  }
}

function writeMain(slug: string | null) {
  try {
    if (slug) localStorage.setItem(MAIN_KEY, slug);
    else localStorage.removeItem(MAIN_KEY);
  } catch {}
}

const MOVE_COUNT = characters.reduce((n, c) => n + c.moves.length, 0);

const FEATURES = [
  {
    to: '/train',
    icon: '🛡️',
    title: 'Punish Trainer',
    text: "Their move hits your shield: pick the punish. Graded on frames, reach after shield pushback, and i-frames, at close or max range.",
  },
  {
    to: '/train?mode=safety',
    icon: '⚖️',
    title: 'Is it safe?',
    text: 'Your move hits their shield. Learn which of your moves are safe against each character, and what punishes the rest.',
  },
  {
    to: '/matchups',
    icon: '⚔️',
    title: 'Matchups',
    text: "Any two fighters: what you punish, what they punish, fastest out-of-shield options and stats side by side.",
  },
  {
    to: '/characters',
    icon: '📊',
    title: 'Fighters & frame data',
    text: 'Every move of all 89 fighters with startup, reach, on-shield advantage and hitbox GIFs, plus each character’s Discord, guides and top players.',
  },
  {
    to: '/progress',
    icon: '📈',
    title: 'Progress',
    text: 'Questions you miss come back until you know them (spaced repetition). See your weak spots and per-matchup accuracy.',
  },
];

export function Home() {
  const [main, setMain] = useState<string | null>(readMain);
  const [changing, setChanging] = useState(false);
  const choose = (slug: string) => {
    setMain(slug);
    writeMain(slug);
    setChanging(false);
  };

  return (
    <div className="home">
      <section className="home-hero">
        <h1>
          Smash <span>Trainer</span>
        </h1>
        <p className="home-tagline">Free practice tools for Super Smash Bros. Ultimate. Learn your punishes, know what's safe, and study every matchup.</p>
        <div className="home-cta">
          <Link className="primary big-link" to={main ? `/train?you=${main}` : '/train'}>Start training</Link>
          <Link className="ghost big-link" to="/characters">Browse fighters</Link>
        </div>
        <p className="muted small">
          {characters.length} fighters · {MOVE_COUNT.toLocaleString()} moves · frame data, reach, pushback and i-frames · no account needed
        </p>
      </section>

      <section className="card home-main">
        {main && !changing ? (
          <MainPanel slug={main} onChange={() => setChanging(true)} />
        ) : (
          <>
            <h2>Who's your main?</h2>
            <p className="muted small">Pick one for quick shortcuts. Saved in this browser.</p>
            <CharacterPicker value={main} onChange={choose} />
            {changing && (
              <button className="ghost small" onClick={() => setChanging(false)}>
                Cancel
              </button>
            )}
          </>
        )}
      </section>

      <section>
        <h2>What's here</h2>
        <div className="home-features">
          {FEATURES.map((f) => (
            <Link key={f.to} to={main && f.to.startsWith('/train') ? `${f.to}${f.to.includes('?') ? '&' : '?'}you=${main}` : f.to} className="card home-feature">
              <span className="home-icon" aria-hidden>{f.icon}</span>
              <b>{f.title}</b>
              <span className="muted small">{f.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-how">
        <h2>How answers are worked out</h2>
        <ul>
          <li><b>Frames:</b> a punish counts if it comes out within the frames the attacker is negative on shield, using Ultimate's out-of-shield rules (shield drop 11 frames, jump 3, shield grab +4, Up B and Up Smash straight from shield).</li>
          <li><b>Reach:</b> it also has to reach after shield pushback. Reach comes from SmashWiki hitbox data, exact where possible and estimated (≈) for hitboxes on limbs and weapons.</li>
          <li><b>I-frames:</b> it can't hit while the opponent is intangible, and invincible options beat moves that are still hitting.</li>
          <li><b>Best punish</b> is the highest-damage one that works. It doesn't know kill power or combos yet.</li>
        </ul>
      </section>

      <p className="muted small home-credits">
        Built on data from <a href="https://ultimateframedata.com" target="_blank" rel="noreferrer">ultimateframedata.com</a>,{' '}
        <a href="https://www.ssbwiki.com" target="_blank" rel="noreferrer">SmashWiki</a> and{' '}
        <a href="https://dragdown.wiki" target="_blank" rel="noreferrer">dragdown</a>. Open source on{' '}
        <a href="https://github.com/yoav74/SmashUltimateTrainer" target="_blank" rel="noreferrer">GitHub</a>.
      </p>
    </div>
  );
}

function MainPanel({ slug, onChange }: { slug: string; onChange: () => void }) {
  const c = characterBySlug.get(slug)!;
  const navigate = useNavigate();
  const [sort] = useFighterSort();
  const now = Date.now();
  const mine = allCards().filter(([id]) => parseCardId(id).you === slug);
  const due = mine.filter(([, s]) => isDue(s, now, Number.MAX_SAFE_INTEGER)).length;
  const weak = weakSpots(mine).length;

  return (
    <div className="home-main-panel">
      <Portrait slug={c.slug} name={c.name} size={96} />
      <div className="home-main-body">
        <div className="muted small">Your main</div>
        <h2>{c.name}</h2>
        <div className="home-main-actions">
          <Link className="primary" to={`/train?you=${slug}`}>Drill punishes</Link>
          <Link className="ghost" to={`/train?you=${slug}&mode=safety`}>Is it safe?</Link>
          <Link className="ghost" to={`/characters/${slug}`}>Frame data & resources</Link>
          <select
            className="mu-select"
            value=""
            onChange={(e) => e.target.value && navigate(`/matchups/${slug}/${e.target.value}`)}
            aria-label="Open a matchup"
          >
            <option value="">Matchup vs…</option>
            {sortFighters(characters, sort)
              .filter((o) => o.slug !== slug)
              .map((o) => (
                <option key={o.slug} value={o.slug}>{o.name}</option>
              ))}
          </select>
        </div>
        <p className="small">
          {mine.length === 0 ? (
            <span className="muted">No practice yet with {c.name}.</span>
          ) : (
            <>
              {due > 0 ? <b className="home-due">{due} review{due > 1 ? 's' : ''} due</b> : <span className="muted">No reviews due</span>}
              <span className="muted"> · {weak} weak spot{weak === 1 ? '' : 's'} · </span>
              <Link to="/progress">Progress</Link>
            </>
          )}
          <span className="muted"> · </span>
          <button className="linklike small" onClick={onChange}>Change main</button>
        </p>
      </div>
    </div>
  );
}
