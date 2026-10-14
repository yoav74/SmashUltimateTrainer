# Setting up accounts (Supabase, Google, Discord)

The site works without accounts. Once the two `VITE_SUPABASE_*` values are set at build time, the **Sign in** link, account page and feedback form switch on. Expect about 30 minutes, once.

Placeholders below: `<ref>` is your Supabase project ref (the `xxxx` in `https://xxxx.supabase.co`). The live site is `https://smashultimatetrainer.yoav74.workers.dev`.

## 1. Supabase project
1. Sign up at [supabase.com](https://supabase.com) (free tier) and create a project. Pick the region closest to most players, and save the database password somewhere safe.
2. **Create the tables:** go to *SQL Editor → New query*, paste the whole of [`supabase/migrations/20261014120000_users.sql`](../supabase/migrations/20261014120000_users.sql), and click **Run**. This creates `profiles`, `favorite_fighters` and `feedback`, all with row-level security.
3. **Keys:** go to *Project Settings → API* (or *Data API*) and copy the **Project URL** and the **anon / public** key. Both are safe in the browser. Never use the `service_role` key in the site.
4. **Redirect URLs:** go to *Authentication → URL Configuration*.
   - **Site URL:** `https://smashultimatetrainer.yoav74.workers.dev`
   - **Redirect URLs:** add `https://smashultimatetrainer.yoav74.workers.dev/**` and `http://localhost:5173/**`
5. **Email sign-up:** *Authentication → Sign In / Providers → Email* is on by default, with "Confirm email" enabled. Supabase's built-in mail sender is rate-limited (a few emails per hour). That's fine to start; before launch, add a custom SMTP sender (e.g. Resend) under *Authentication → Emails → SMTP*.

## 2. Google login
1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one).
2. *APIs & Services → OAuth consent screen*: choose **External**, set the app name ("Smash Trainer"), a support email and the site link, and keep the default scopes (email, profile).
3. *APIs & Services → Credentials → Create credentials → OAuth client ID*, type **Web application**.
   - **Authorized redirect URI:** `https://<ref>.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client secret** into Supabase: *Authentication → Sign In / Providers → Google* → enable → paste → Save.
5. While the consent screen is in "Testing", only test users you add can sign in. Click **Publish app** when you're ready for everyone.

## 3. Discord login
1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** ("Smash Trainer").
2. *OAuth2 → Redirects* → add `https://<ref>.supabase.co/auth/v1/callback` → Save.
3. Copy the **Client ID** and **Client Secret** (Reset Secret if needed) into Supabase: *Authentication → Sign In / Providers → Discord* → enable → paste → Save.

## 4. Turn it on for the live site (Cloudflare)
1. Cloudflare dashboard → *Workers & Pages* → **smashultimatetrainer** → *Settings → Build → Variables and secrets*.
2. Add two build variables (plain text):
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
3. Redeploy: push any commit, or *Deployments → … → Retry build*. Vite bakes these into the build, so a rebuild is required.

## 5. Local development
Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the same two values, then restart `npm run dev`. `.env.local` is git-ignored.

## Reading feedback
Supabase *Table Editor → feedback*. Change a row's `status` to `seen`, `done` or `wontfix`, and the sender sees it on their feedback page.

## What's stored
- `profiles`: display name and avatar (from Google/Discord, or the name chosen at sign-up).
- `favorite_fighters`: each user's mains, in order (the first is the primary main).
- `feedback`: category, message, optional page, and status. At most 20 per user per day.

Each user can only read and change their own rows (row-level security). Deleting a user in *Authentication → Users* deletes their rows too.
