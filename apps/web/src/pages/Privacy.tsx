import { Link } from 'react-router-dom';

/** /privacy: plain-language privacy policy (also required for Google sign-in). */
export function Privacy() {
  return (
    <div className="auth-page legal">
      <h1>Privacy policy</h1>
      <p className="muted small">Last updated: October 14, 2026</p>

      <p>
        Smash Trainer is a free, fan-made practice site for Super Smash Bros. Ultimate. It's run by one person as a hobby project, with no ads
        and nothing for sale. This page explains what it stores about you and why.
      </p>

      <h2>Without an account</h2>
      <p>
        You can use everything except feedback without signing in. Your trainer progress, review schedule, chosen main and display settings are
        saved only in your browser (local storage). They never leave your device, and clearing your browser data deletes them.
      </p>

      <h2>With an account</h2>
      <p>If you register or sign in with Google or Discord, we store:</p>
      <ul>
        <li>your email address and a sign-in identifier from Google or Discord (to let you sign in);</li>
        <li>a display name (from your Google/Discord profile or the one you choose; you can change it);</li>
        <li>your profile picture, only if you choose to use your Google or Discord picture;</li>
        <li>your mains (favorite fighters);</li>
        <li>feedback you send, including the optional page it's about.</li>
      </ul>
      <p>
        We only ask Google and Discord for your basic profile and email. We don't get your contacts, servers, messages or anything else. Your data
        is only visible to you and to the site owner, and is never sold or shared for advertising.
      </p>

      <h2>Where it's stored</h2>
      <p>
        Account data is stored with <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a> (database and sign-in). The site is
        served by <a href="https://www.cloudflare.com" target="_blank" rel="noreferrer">Cloudflare</a>. Both act as processors for this site.
      </p>

      <h2>Deleting your data</h2>
      <p>
        To delete your account and everything stored with it, send a request from the <Link to="/feedback">feedback page</Link> (choose "Other") or
        open an issue on <a href="https://github.com/yoav74/SmashUltimateTrainer/issues" target="_blank" rel="noreferrer">GitHub</a>. It will be
        removed, including your mains and feedback.
      </p>

      <h2>Cookies</h2>
      <p>No tracking or advertising cookies. Signing in stores a session token in your browser so you stay signed in.</p>

      <h2>Contact</h2>
      <p>
        Questions: use the <Link to="/feedback">feedback page</Link> or{' '}
        <a href="https://github.com/yoav74/SmashUltimateTrainer/issues" target="_blank" rel="noreferrer">GitHub</a>.
      </p>

      <p className="muted small">Not affiliated with Nintendo. Super Smash Bros. is a trademark of Nintendo.</p>
    </div>
  );
}
