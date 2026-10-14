import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, type FeedbackRow } from '../lib/auth';

const CATEGORIES: { value: FeedbackRow['category']; label: string }[] = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'data', label: 'Wrong frame data or answer' },
  { value: 'idea', label: 'Idea or request' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABEL: Record<FeedbackRow['status'], string> = { new: 'Received', seen: 'Seen', done: 'Done', wontfix: "Won't do" };

/** /feedback: registered users send feedback and see what they've sent. */
export function Feedback() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [category, setCategory] = useState<FeedbackRow['category']>('idea');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(params.get('page') ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<FeedbackRow[] | null>(null);

  const signedIn = !!auth.session;
  useEffect(() => {
    if (signedIn) auth.myFeedback().then(setMine).catch(() => setMine([]));
  }, [signedIn, state]);

  if (!auth.enabled) {
    return (
      <div className="auth-page">
        <h1>Feedback</h1>
        <p className="muted">
          Feedback needs accounts, which aren't switched on yet. Meanwhile, open an issue on{' '}
          <a href="https://github.com/yoav74/SmashUltimateTrainer/issues" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </div>
    );
  }
  if (!signedIn) {
    return (
      <div className="auth-page">
        <h1>Feedback</h1>
        <p>
          <Link to="/login">Sign in or create an account</Link> to send feedback. It takes a few seconds with Google or Discord.
        </p>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      await auth.submitFeedback({ category, message, page: page.trim() || null });
      setMessage('');
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send');
      setState('idle');
    }
  };

  return (
    <div className="auth-page">
      <h1>Feedback</h1>
      <p className="muted small">Bugs, wrong answers, ideas: everything helps. Only you and the site owner can see what you send.</p>
      {state === 'sent' && <p className="auth-notice">Thanks! Your feedback was sent.</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>
          What's it about?
          <select value={category} onChange={(e) => setCategory(e.target.value as FeedbackRow['category'])}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label>
          Message
          <textarea
            required
            minLength={5}
            maxLength={4000}
            rows={6}
            value={message}
            onChange={(e) => { setMessage(e.target.value); if (state === 'sent') setState('idle'); }}
            placeholder={category === 'data' ? 'Which fighter and move, what the site says, and what it should be' : ''}
          />
          <span className="muted small">{message.length}/4000</span>
        </label>
        <label>
          Page (optional)
          <input value={page} onChange={(e) => setPage(e.target.value)} maxLength={300} placeholder="e.g. /matchups/lucas/kirby" />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send feedback'}</button>
      </form>

      {mine && mine.length > 0 && (
        <section>
          <h2>What you've sent</h2>
          <ul className="plain feedback-list">
            {mine.map((f) => (
              <li key={f.id} className="card">
                <div className="small muted">
                  {CATEGORIES.find((c) => c.value === f.category)?.label} · {new Date(f.created_at).toLocaleDateString()} ·{' '}
                  <span className={`fb-status ${f.status}`}>{STATUS_LABEL[f.status]}</span>
                  {f.page && <> · {f.page}</>}
                </div>
                <p>{f.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
