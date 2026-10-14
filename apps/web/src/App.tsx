import { useEffect } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Trainer } from './pages/Trainer';
import { CharacterDetail, CharacterList } from './pages/Characters';
import { MatchupPage, MatchupPicker } from './pages/Matchups';
import { Progress } from './pages/Progress';

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, and React treats an effect's return value as cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function CharacterRoute() {
  const { slug = '' } = useParams();
  return <CharacterDetail slug={slug} />;
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <nav className="topnav">
        <Link to="/" className="brand">Smash Trainer</Link>
        <NavLink to="/" end>Trainer</NavLink>
        <NavLink to="/characters">Fighters</NavLink>
        <NavLink to="/matchups">Matchups</NavLink>
        <NavLink to="/progress">Progress</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Trainer />} />
          <Route path="/characters" element={<CharacterList />} />
          <Route path="/characters/:slug" element={<CharacterRoute />} />
          <Route path="/matchups" element={<MatchupPicker />} />
          <Route path="/matchups/:you/:opp" element={<MatchupPage />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      <footer className="footer muted small">
        Free, fan-made and open source. Not affiliated with Nintendo. Frame data from{' '}
        <a href="https://ultimateframedata.com" target="_blank" rel="noreferrer">ultimateframedata.com</a>; community resources
        from <a href="https://dragdown.wiki" target="_blank" rel="noreferrer">dragdown</a> and{' '}
        <a href="https://www.ssbwiki.com" target="_blank" rel="noreferrer">SmashWiki</a>.
      </footer>
    </BrowserRouter>
  );
}
