import { useState } from 'react';
import { Link } from 'react-router-dom';
import { characterBySlug, characters, dataSource, resourcesFor, youtubeSearch, type ResourceLink } from '@smash-trainer/data';
import { Portrait } from '../components/Media';
import { punishOptions } from '@smash-trainer/core';

export function CharacterList() {
  const [query, setQuery] = useState('');
  const shown = characters.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div>
      <h1>Fighters</h1>
      <input className="search" placeholder="Search fighters…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="char-grid">
        {shown.map((c) => (
          <Link key={c.slug} className="char-card" to={`/characters/${c.slug}`}>
            <Portrait slug={c.slug} name={c.name} size={96} />
            <span>{c.name}</span>
          </Link>
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

const KIND_ICON: Record<ResourceLink['kind'], string> = { sheet: '📊', doc: '📄', video: '▶️', tweet: '🐦', link: '🔗', discord: '💬' };

const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) + (url.length > 56 ? '…' : '');

function Resources({ slug, name }: { slug: string; name: string }) {
  const r = resourcesFor(slug);
  const sections = [...new Set(r.links.map((l) => l.section))];

  return (
    <section className="resources">
      <h2>Community & Resources</h2>
      <div className="detail-top">
        <div className="card">
          <h3>Discord</h3>
          {r.discords.length ? (
            <ul className="plain">
              {r.discords.map((d) => (
                <li key={d.url}>
                  <a className="link-btn discord" href={d.url} target="_blank" rel="noreferrer">{d.name}</a>
                  {d.members && <span className="muted small"> {d.members.toLocaleString()} members</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No working invite found. The one listed on SmashWiki has expired.</p>
          )}
          <p className="muted small">Character Discords usually pin their guides, matchup docs and combo sheets in a resources channel.</p>
        </div>

        <div className="card">
          <h3>Watch & learn</h3>
          <ul className="plain">
            {r.vodArchive && <li><a href={r.vodArchive} target="_blank" rel="noreferrer">🏆 Tournament VODs (Smash Archives) ↗</a></li>}
            <li><a href={youtubeSearch(`${name} smash ultimate combo video`)} target="_blank" rel="noreferrer">🎬 YouTube combo videos ↗</a></li>
            {r.wiki && <li><a href={r.wiki} target="_blank" rel="noreferrer">📚 {name} on dragdown wiki ↗</a></li>}
          </ul>
        </div>
      </div>

      {r.players.length > 0 && (
        <>
          <h3>Players to watch</h3>
          <div className="players">
            {r.players.map((p) => (
              <div key={p.name} className="card player">
                <div><b>{p.name}</b> {p.region && <span className="tag">{p.region}</span>}</div>
                {p.note && <p className="small">{p.note}</p>}
                {p.footage && (
                  <a className="small" href={p.footage} target="_blank" rel="noreferrer">▶ {p.footageTitle ?? 'Watch footage'}</a>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {sections.length > 0 && (
        <>
          <h3>Guides, docs & videos</h3>
          <div className="link-sections">
            {sections.map((sec) => (
              <div key={sec} className="card">
                <h4>{sec}</h4>
                <ul className="plain">
                  {r.links.filter((l) => l.section === sec).map((l, i) => (
                    <li key={l.url + i}>
                      {KIND_ICON[l.kind]} <a href={l.url} target="_blank" rel="noreferrer">{l.label ?? shortUrl(l.url)}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
      {!sections.length && !r.players.length && (
        <p className="muted small">No public docs collected for {name} yet. Check the Discord's resources channel.</p>
      )}
      {r.sources.length > 0 && (
        <p className="muted small">
          Collected from {r.sources.map((s, i) => <a key={s} href={s} target="_blank" rel="noreferrer">{i ? ', ' : ''}dragdown</a>)} and SmashWiki.
        </p>
      )}
    </section>
  );
}

export function CharacterDetail({ slug }: { slug: string }) {
  const c = characterBySlug.get(slug);
  if (!c) return <p>Unknown fighter.</p>;
  const categories = Object.keys(CATEGORY_LABEL).filter((k) => c.moves.some((m) => m.category === k));
  const oos = punishOptions(c).slice(0, 6);
  const discord = resourcesFor(slug).discords[0];

  return (
    <div className="detail">
      <Link to="/characters" className="ghost">← All fighters</Link>
      <header className="hero">
        <Portrait slug={c.slug} name={c.name} size={120} className="hero-portrait" />
        <div>
          <h1>{c.name}</h1>
          <div className="hero-actions">
            <Link className="primary" to={`/?you=${c.slug}`}>Train as {c.name}</Link>
            {discord && <a className="link-btn discord" href={discord.url} target="_blank" rel="noreferrer">Join Discord</a>}
          </div>
        </div>
      </header>

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
          <h3>Stats</h3>
          <ul className="plain small">
            {Object.entries(c.stats).slice(0, 10).map(([k, v]) => (
              <li key={k}><span className="muted">{k}:</span> {v}</li>
            ))}
          </ul>
        </div>
      </div>

      <Resources slug={c.slug} name={c.name} />

      <h2 className="section-title">Frame data</h2>
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
