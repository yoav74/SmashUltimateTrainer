import { useState } from 'react';
import { characters } from '../data/characters';

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
          <button className={`chip random ${value === RANDOM ? 'selected' : ''}`} onClick={() => onChange(RANDOM)}>
            🎲 Random
          </button>
        )}
        {shown.map((c) => (
          <button
            key={c.slug}
            className={`chip ${value === c.slug ? 'selected' : ''}`}
            onClick={() => onChange(c.slug)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
