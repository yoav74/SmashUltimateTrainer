import { useState } from 'react';
import { characterBySlug, characters, dataSource } from '../data/characters';
import { community, youtubeSearch } from '../data/community';
import { punishOptions } from '../lib/punish';

export function CharacterList() {
  const [query, setQuery] = useState('');
  const shown = characters.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <h1>Fighters</h1>
      <input className="search" placeholder="Search fighters…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="char-grid">
        {shown.map((c) => (
          <a key={c.slug} className="char-card" href={`#/characters/${c.slug}`}>
            <span className="initials">{c.name.replace(/[^A-Z]/g, '').slice(0, 2) || c.name[0]}</span>
            <span>{c.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  groundattacks: 'Ground Attacks',
  aerialattacks: 'Aerials',
  specialattacks: 'Specials',
  grabs: 'Grabs & Throws',
  dodges: 'Dodges',
};

export function CharacterDetail({ slug }: { slug: string }) {
  const c = characterBySlug.get(slug);
  if (!c) return <p>Unknown fighter.</p>;
  const links = community[slug] ?? {};
  const categories = Object.keys(CATEGORY_LABEL).filter((k) => c.moves.some((m) => m.category === k));
  const oos = punishOptions(c).slice(0, 6);

  return (
    <div className="detail">
      <a href="#/characters" className="ghost">← All fighters</a>
      <h1>{c.name}</h1>

      <div className="detail-top">
        <div className="card">
          <h3>Fastest out of shield</h3>
          <ul className="plain">
            {oos.map((o) => (
              <li key={o.move.name}>
                <b>F{o.oosFrame}</b> {o.move.name} <span className="muted small">({o.method})</span>
              </li>
            ))}
          </ul>
          {c.oos.length > 0 && (
            <p className="muted small">UFD's listed OoS: {c.oos.map((o) => `${o.options} (F${o.frame})`).join(' · ')}</p>
          )}
        </div>

        <div className="card">
          <h3>Community</h3>
          {links.discord ? (
            <a className="link-btn discord" href={links.discord} target="_blank" rel="noreferrer">Join the {c.name} Discord</a>
          ) : (
            <p className="muted small">No Discord link yet. Add one in <code>src/data/community.ts</code>.</p>
          )}
          <h4>Highlights</h4>
          <ul className="plain">
            {(links.highlights ?? []).map((h) => (
              <li key={h.url}><a href={h.url} target="_blank" rel="noreferrer">{h.title}</a></li>
            ))}
            <li><a href={youtubeSearch(`${c.name} smash ultimate combo video`)} target="_blank" rel="noreferrer">Search YouTube for {c.name} highlights ↗</a></li>
          </ul>
        </div>

        <div className="card">
          <h3>Stats</h3>
          <ul className="plain small">
            {Object.entries(c.stats).slice(0, 10).map(([k, v]) => (
              <li key={k}><span className="muted">{k}:</span> {v}</li>
            ))}
          </ul>
        </div>
      </div>

      {categories.map((cat) => (
        <section key={cat}>
          <h2>{CATEGORY_LABEL[cat]}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Move</th><th>Startup</th><th>Active</th><th>Total</th><th>Landing lag</th><th>Damage</th><th>On shield</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {c.moves.filter((m) => m.category === cat).map((m) => (
                  <tr key={m.name}>
                    <td className="move-name">
                      {m.hitboxGifs[0] ? <a href={m.hitboxGifs[0]} target="_blank" rel="noreferrer">{m.name}</a> : m.name}
                    </td>
                    <td>{m.raw.startup ?? '—'}</td>
                    <td>{m.raw.activeFrames ?? '—'}</td>
                    <td>{m.raw.totalFrames ?? '—'}</td>
                    <td>{m.raw.landingLag ?? '—'}</td>
                    <td>{m.raw.damage ?? '—'}</td>
                    <td className={m.shieldAdvantage.some((a) => a.value < 0) ? 'neg' : ''}>{m.raw.advantage ?? '—'}</td>
                    <td className="notes">{m.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="muted small">
        Frame data from <a href={dataSource.url} target="_blank" rel="noreferrer">ultimateframedata.com</a>, scraped{' '}
        {new Date(dataSource.scrapedAt).toLocaleDateString()}.
      </p>
    </div>
  );
}
