import { useState } from 'react';
import { characters } from '../data/characters';
import { Portrait } from './Media';

interface Props {
  value: string | null;
  onChange: (slug: string) => void;
  allowRandom?: boolean;
}

export const RANDOM = '__random__';

export function CharacterPicker({ value, onChange, allowRandom }: Props) {
  const [query, setQuery] = useState('');
  const shown = characters.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="picker">
      <input
        className="search"
        placeholder="Search fighters…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="picker-grid">
        {allowRandom && (
          <button className={`tile random ${value === RANDOM ? 'selected' : ''}`} onClick={() => onChange(RANDOM)} title="Random">
            <span className="tile-random">🎲</span>
            <span className="tile-name">Random</span>
          </button>
        )}
        {shown.map((c) => (
          <button
            key={c.slug}
            className={`tile ${value === c.slug ? 'selected' : ''}`}
            onClick={() => onChange(c.slug)}
            title={c.name}
          >
            <Portrait slug={c.slug} name={c.name} size={64} />
            <span className="tile-name">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
