import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { characterBySlug } from '@smash-trainer/data';
import { CharacterPicker } from '../components/CharacterPicker';
import { Portrait } from '../components/Media';
import { MAX_FAVORITES, useAuth, type OAuthProvider } from '../lib/auth';

function NotConfigured() {
  return (
    <div className="auth-page">
      <h1>Accounts</h1>
      <p className="muted">Accounts aren't switched on for this site yet. Everything else works without one.</p>
    </div>
  );
}

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'discord', label: 'Continue with Discord' },
];

/** /login: Google, Discord, or email and password (sign in or register). */
export function Login() {
  const auth = useAuth();
  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!auth.enabled) return <NotConfigured />;
  if (auth.session) return <Navigate to="/account" replace />;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(/failed to fetch|network/i.test(msg) ? "Can't reach the account server. Check your connection and try again." : msg);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'signin') await auth.signInWithPassword(email, password);
      else if (mode === 'register') {
        const r = await auth.signUp(email, password, name.trim() || email.split('@')[0]);
        if (r === 'check-email') setNotice(`Almost done: we sent a confirmation link to ${email}. Open it to finish registering.`);
      } else {
        await auth.sendPasswordReset(email);
        setNotice(`If ${email} has an account, a password reset link is on its way.`);
      }
    });
  };

  return (
    <div className="auth-page">
      <h1>{mode === 'register' ? 'Create an account' : mode === 'forgot' ? 'Reset your password' : 'Sign in'}</h1>
      <p className="muted small">Save your mains, send feedback, and (soon) keep your progress across devices.</p>

      {mode !== 'forgot' && (
        <>
          <div className="oauth-buttons">
            {PROVIDERS.map((p) => (
              <button key={p.id} className={`oauth-btn ${p.id}`} disabled={busy} onClick={() => run(() => auth.signInWithProvider(p.id))}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="auth-divider"><span>or with email</span></div>
        </>
      )}

      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && (
          <label>
            Display name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="What other players see" autoComplete="nickname" />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        {mode !== 'forgot' && (
          <label>
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            {mode === 'register' && <span className="muted small">At least 8 characters.</span>}
          </label>
        )}
        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
        </button>
      </form>

      <p className="small auth-switch">
        {mode === 'signin' ? (
          <>
            New here? <button className="linklike" onClick={() => setMode('register')}>Create an account</button> ·{' '}
            <button className="linklike" onClick={() => setMode('forgot')}>Forgot password?</button>
          </>
        ) : (
          <>
            Already have an account? <button className="linklike" onClick={() => setMode('signin')}>Sign in</button>
          </>
        )}
      </p>
    </div>
  );
}

/** /account: profile, mains, password reset landing. */
export function Account() {
  const auth = useAuth();
  const [params] = useSearchParams();
  if (!auth.enabled) return <NotConfigured />;
  if (auth.loading) return <p className="muted">Loading…</p>;
  if (!auth.session) return <Navigate to="/login" replace />;

  const user = auth.session.user;
  const providers = (user.app_metadata.providers as string[] | undefined) ?? [user.app_metadata.provider ?? 'email'];

  return (
    <div className="auth-page account-page">
      <h1>Your account</h1>
      {params.get('reset') && <NewPassword />}

      <section className="card">
        <ProfileEditor />
        <p className="muted small">
          {user.email} · signed in with {providers.map((p) => (p === 'email' ? 'email' : p[0].toUpperCase() + p.slice(1))).join(', ')}
        </p>
      </section>

      <section className="card">
        <Mains />
      </section>

      <section className="account-links">
        <Link className="ghost" to="/feedback">Send feedback</Link>
        <button className="ghost" onClick={() => auth.signOut()}>Sign out</button>
      </section>
    </div>
  );
}

function ProfileEditor() {
  const auth = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(auth.profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const p = auth.profile;
  if (!p) return <p className="muted">Loading profile…</p>;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await auth.updateDisplayName(name);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  };

  return (
    <div className="profile-row">
      {p.avatar_url ? <img className="avatar big" src={p.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span className="avatar big">{p.display_name[0]?.toUpperCase()}</span>}
      {editing ? (
        <form className="inline-form" onSubmit={save}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus />
          <button className="primary" type="submit">Save</button>
          <button className="ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>
          {error && <span className="auth-error">{error}</span>}
        </form>
      ) : (
        <div>
          <h2>{p.display_name}</h2>
          <button className="linklike small" onClick={() => { setName(p.display_name); setEditing(true); }}>Edit name</button>
        </div>
      )}
    </div>
  );
}

function Mains() {
  const auth = useAuth();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const favs = auth.favorites;

  const update = async (next: string[]) => {
    try {
      setError(null);
      await auth.setFavorites(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <>
      <h2>Your mains</h2>
      <p className="muted small">Up to {MAX_FAVORITES}. The first one is your primary main: the home page and trainer start with it.</p>
      {favs.length === 0 && <p className="muted">None yet.</p>}
      <div className="mains">
        {favs.map((slug, i) => {
          const c = characterBySlug.get(slug);
          if (!c) return null;
          return (
            <div key={slug} className={`main-chip ${i === 0 ? 'primary-main' : ''}`}>
              <Portrait slug={slug} name={c.name} size={56} />
              <div>
                <Link to={`/characters/${slug}`}><b>{c.name}</b></Link>
                <div className="small">
                  {i === 0 ? (
                    <span className="muted">Primary</span>
                  ) : (
                    <button className="linklike" onClick={() => update([slug, ...favs.filter((s) => s !== slug)])}>Make primary</button>
                  )}
                  {' · '}
                  <button className="linklike" onClick={() => update(favs.filter((s) => s !== slug))}>Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p className="auth-error">{error}</p>}
      {favs.length < MAX_FAVORITES &&
        (adding ? (
          <>
            <CharacterPicker
              value={null}
              onChange={(slug) => {
                if (!favs.includes(slug)) update([...favs, slug]);
                setAdding(false);
              }}
            />
            <button className="ghost small" onClick={() => setAdding(false)}>Cancel</button>
          </>
        ) : (
          <button className="ghost" onClick={() => setAdding(true)}>+ Add a main</button>
        ))}
    </>
  );
}

function NewPassword() {
  const auth = useAuth();
  const [pw, setPw] = useState('');
  const [state, setState] = useState<'idle' | 'saved' | string>('idle');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await auth.updatePassword(pw);
      setState('saved');
    } catch (err) {
      setState(err instanceof Error ? err.message : 'Could not save');
    }
  };
  return (
    <section className="card">
      <h2>Set a new password</h2>
      {state === 'saved' ? (
        <p className="auth-notice">Password updated.</p>
      ) : (
        <form className="inline-form" onSubmit={save}>
          <input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="New password" />
          <button className="primary" type="submit">Save</button>
          {state !== 'idle' && <span className="auth-error">{state}</span>}
        </form>
      )}
    </section>
  );
}
