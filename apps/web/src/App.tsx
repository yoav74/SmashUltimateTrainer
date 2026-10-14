import { useEffect } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Trainer } from './pages/Trainer';
import { CharacterDetail, CharacterList } from './pages/Characters';
import { MatchupPage, MatchupPicker } from './pages/Matchups';
import { Progress } from './pages/Progress';
import { Home } from './pages/Home';
import { Account, Login } from './pages/Account';
import { Feedback } from './pages/Feedback';
import { AuthProvider, useAuth } from './lib/auth';

function ScrollToTop() {
  const { pathname } = useLocation();
  // Braces matter: newer browsers return a Promise from scrollTo, and React treats an effect's return value as cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** The trainer used to live at "/". Old links like /?you=lucas still open it. */
function HomeRoute() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (params.has('you') || params.has('opp') || params.has('mode')) return <Navigate to={`/train${search}`} replace />;
  return <Home />;
}

/** Top-right of the nav: "Sign in", or the signed-in user's avatar. Hidden until accounts are configured. */
function UserNav() {
  const auth = useAuth();
  if (!auth.enabled || auth.loading) return null;
  if (!auth.session) return <NavLink to="/login" className="user-nav">Sign in</NavLink>;
  const p = auth.profile;
  return (
    <NavLink to="/account" className="user-nav" title={p?.display_name ?? 'Account'}>
      {p?.avatar_url ? <img className="avatar" src={p.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span className="avatar">{p?.display_name[0]?.toUpperCase() ?? '?'}</span>}
    </NavLink>
  );
}

function CharacterRoute() {
  const { slug = '' } = useParams();
  return <CharacterDetail slug={slug} />;
}

export function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <ScrollToTop />
      <nav className="topnav">
        <Link to="/" className="brand">Smash Trainer</Link>
        <NavLink to="/train">Trainer</NavLink>
        <NavLink to="/characters">Fighters</NavLink>
        <NavLink to="/matchups">Matchups</NavLink>
        <NavLink to="/progress">Progress</NavLink>
        <UserNav />
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/train" element={<Trainer />} />
          <Route path="/characters" element={<CharacterList />} />
          <Route path="/characters/:slug" element={<CharacterRoute />} />
          <Route path="/matchups" element={<MatchupPicker />} />
          <Route path="/matchups/:you/:opp" element={<MatchupPage />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      <footer className="footer muted small">
        Free, fan-made and open source. Not affiliated with Nintendo. Frame data from{' '}
        <a href="https://ultimateframedata.com" target="_blank" rel="noreferrer">ultimateframedata.com</a>; community resources
        from <a href="https://dragdown.wiki" target="_blank" rel="noreferrer">dragdown</a> and{' '}
        <a href="https://www.ssbwiki.com" target="_blank" rel="noreferrer">SmashWiki</a>. <Link to="/feedback">Send feedback</Link>
      </footer>
    </BrowserRouter>
    </AuthProvider>
  );
}
