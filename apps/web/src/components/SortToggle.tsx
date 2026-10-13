import { useFighterSort } from '../lib/fighterSort';

export function SortToggle() {
  const [sort, setSort] = useFighterSort();
  return (
    <div className="segmented" role="group" aria-label="Sort fighters">
      <button className={sort === 'number' ? 'on' : ''} aria-pressed={sort === 'number'} onClick={() => setSort('number')}>
        Smash #
      </button>
      <button className={sort === 'name' ? 'on' : ''} aria-pressed={sort === 'name'} onClick={() => setSort('name')}>
        A–Z
      </button>
    </div>
  );
}
