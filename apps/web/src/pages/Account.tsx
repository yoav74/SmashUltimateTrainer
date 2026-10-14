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

// Must match Supabase: Authentication → Sign In / Providers → Email → password requirements.
const PASSWORD_RULES: { label: string; ok: (pw: string) => boolean }[] = [
  { label: 'At least 8 characters', ok: (pw) => pw.length >= 8 },
  { label: 'A lowercase letter', ok: (pw) => /[a-z]/.test(pw) },
  { label: 'An uppercase letter', ok: (pw) => /[A-Z]/.test(pw) },
  { label: 'A digit', ok: (pw) => /[0-9]/.test(pw) },
];

const passwordOk = (pw: string) => PASSWORD_RULES.every((r) => r.ok(pw));

function PasswordRules({ pw }: { pw: string }) {
  return (
    <ul className="pw-rules small">
      {PASSWORD_RULES.map((r) => (
        <li key={r.label} className={r.ok(pw) ? 'ok' : ''}>{r.ok(pw) ? '✓' : '○'} {r.label}</li>
      ))}
    </ul>
  );
}

// Official marks, as Google's and Discord's sign-in button guidelines describe.
function GoogleLogo() {
  return (
    <svg className="oauth-logo" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg className="oauth-logo" viewBox="0 0 127.14 96.36" aria-hidden="true">
      <path
        fill="currentColor"
        d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
      />
    </svg>
  );
}

const PROVIDERS: { id: OAuthProvider; label: string; Logo: () => JSX.Element }[] = [
  { id: 'google', label: 'Continue with Google', Logo: GoogleLogo },
  { id: 'discord', label: 'Continue with Discord', Logo: DiscordLogo },
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
      <p className="muted small">
        Save your mains, send feedback, and (soon) keep your progress across devices. <Link to="/privacy">What we store</Link>
      </p>

      {mode !== 'forgot' && (
        <>
          <div className="oauth-buttons">
            {PROVIDERS.map((p) => (
              <button key={p.id} className={`oauth-btn ${p.id}`} disabled={busy} onClick={() => run(() => auth.signInWithProvider(p.id))}>
                <p.Logo />
                <span>{p.label}</span>
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
            {mode === 'register' && <PasswordRules pw={password} />}
          </label>
        )}
        {error && <p className="auth-error">{error}</p>}
        {notice && <p className="auth-notice">{notice}</p>}
        <button className="primary" type="submit" disabled={busy || (mode === 'register' && !passwordOk(password))}>
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
      <AvatarPrompt />

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

const providerName = (provider: string | undefined) => (provider === 'discord' ? 'Discord' : 'Google');

/** Asked once, the first time a Google/Discord user opens their account. */
function AvatarPrompt() {
  const auth = useAuth();
  const p = auth.profile;
  if (!p || p.avatar_asked || !auth.providerAvatar) return null;
  const name = providerName(auth.session?.user.app_metadata.provider);
  return (
    <section className="card avatar-prompt">
      <img className="avatar big" src={auth.providerAvatar} alt="" referrerPolicy="no-referrer" />
      <div>
        <b>Use your {name} picture?</b>
        <p className="muted small">It's only shown on your account. You can change this any time.</p>
        <div className="inline-form">
          <button className="primary" onClick={() => auth.setUseProviderAvatar(true)}>Use it</button>
          <button className="ghost" onClick={() => auth.setUseProviderAvatar(false)}>No thanks</button>
        </div>
      </div>
    </section>
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
          {auth.providerAvatar && p.avatar_asked && (
            <>
              {' · '}
              <button className="linklike small" onClick={() => auth.setUseProviderAvatar(!p.avatar_url)}>
                {p.avatar_url ? 'Remove picture' : `Use ${providerName(auth.session?.user.app_metadata.provider)} picture`}
              </button>
            </>
          )}
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
          <button className="primary" type="submit" disabled={!passwordOk(pw)}>Save</button>
          <PasswordRules pw={pw} />
          {state !== 'idle' && <span className="auth-error">{state}</span>}
        </form>
      )}
    </section>
  );
}
