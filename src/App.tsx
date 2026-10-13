import { useEffect, useState } from 'react';
import { Trainer } from './pages/Trainer';
import { CharacterDetail, CharacterList } from './pages/Characters';

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function App() {
  const route = useHashRoute();
  const [page, param] = route;

  return (
    <>
      <nav className="topnav">
        <a href="#/" className="brand">Smash Trainer</a>
        <a href="#/" className={!page ? 'active' : ''}>Punish Trainer</a>
        <a href="#/characters" className={page === 'characters' ? 'active' : ''}>Fighters</a>
      </nav>
      <main>
        {page === 'characters' ? param ? <CharacterDetail slug={param} /> : <CharacterList /> : <Trainer />}
      </main>
    </>
  );
}
