# Smash Trainer → the improvement hub for Smash Ultimate players

## Context
`D:\SmashTrainer` is a working local React + TS + Vite app: UFD frame data for 89 fighters, a punish trainer, fighter pages with portraits/GIFs, and community resources (verified Discords, dragdown docs, Smash Archives VODs). The goal now is to grow it into *the* place Smash players go to improve, and later a desktop practice tool with controller support.

Decisions from the user:
- **Free community project.** Open source, donations at most, no ads.
- **Solo, a few hours a week.** Every phase must ship something usable on its own, and we use managed services so there's no ops work.
- **Practice tool = reaction drills + input/execution trainer.** No capture card, no emulator hooks.
- **Keep React + TS.** Extend the current code rather than rewrite it.

## Guiding principles
1. **Static-first.** Frame data and resources are build-time JSON served from a CDN, which costs close to nothing at any traffic level. Add a backend only when a feature needs shared or user state.
2. **Web-first, desktop later.** The browser Gamepad API already reads controllers, so drills ship on the web first. The desktop app (Tauri) only adds what the web can't do: high-rate polling, GameCube adapter, overlays, offline.
3. **The community curates, the engine computes.** Frame math stays automatic. Things a scraper can't know (the *best* punish, spacing, matchup notes) come from character-Discord maintainers through a moderated flow.
4. **Credit and permission for every source.** UFD, dragdown, SmashWiki and Smash Archives are credited on every page. Ask before re-hosting anyone's media.

## Target architecture (grow into it, don't build up front)
```
smash-trainer/            (pnpm workspaces, introduced in Phase 0)
  packages/core           punish engine + types   ← src/lib/punish.ts, src/data/types.ts, src/lib/stats.ts
  packages/data           scrapers + validation   ← scripts/scrape-ufd.mjs, scripts/scrape-resources.mjs, scripts/validate-oos.ts
  apps/web                React app               ← src/pages, src/components
  apps/desktop            Tauri shell (Phase 4), reuses apps/web UI + packages/core
```
- **Hosting:** Cloudflare Pages (free, global CDN), with a domain.
- **Media:** convert UFD GIFs to WebM/MP4 with ffmpeg (Kazuya's 5 MB GIF becomes roughly 300 KB) and host them on Cloudflare R2. Only after UFD agrees; until then keep hotlinking with lazy loading.
- **Backend (Phase 2):** Supabase, for Discord OAuth login, Postgres (progress, submissions, curated punishes) with row-level security, and its free tier.
- **SEO:** prerender fighter and matchup pages at build time (`vite-react-ssg` + React Router) so "lucas frame data" and "lucas vs kirby" can rank on Google. No move to Next.js.

## Phases

### Phase 0: Foundation (about 2–3 weeks)
- Restructure into the workspace layout above. Move the engine into `packages/core` unchanged.
- Add Vitest tests:
  - Turn `scripts/validate-oos.ts` into a test that requires ≥79 fighters to match.
  - Add unit tests for `grade`/`punishOptions` (Lucas vs Kirby forward smash, Puff Rest at frame 5, Kazuya jumpsquat).
- Add React Router in place of the hand-rolled hash router in `src/App.tsx`.
- Set up GitHub repo, MIT license, CONTRIBUTING.md, and a GitHub Actions workflow that runs typecheck, tests and build.
- Deploy to Cloudflare Pages and add a scheduled weekly CI job that re-runs both scrapers and opens a PR when data changes.
- Fix the local Node setup (nvm on Node 22 LTS) so `npm run` works without the workaround.
- Outreach: message UFD (MetalMusicMan) and the dragdown editors. Introduce the project, credit them, and ask about GIF re-hosting and collaboration.

### Phase 1: Public launch MVP (about 1–2 months)
- **Matchup pages** (`/matchups/lucas/kirby`):
  - Your punishable moves against their out-of-shield options, and theirs against yours.
  - Their safest moves, plus links to both Discords and resources.
  - Generated for all 89×89 pairs.
- **New drills,** reusing `situationsFor`/`punishOptions`:
  - *"Is it safe?"*: your own move against a chosen opponent's fastest out-of-shield option.
  - *Out-of-shield quiz*: "What's Fox's fastest OoS?"
  - *Frame window speed round*: a timed version of the current drill.
- **Spaced repetition:** extend `src/lib/stats.ts` to track per-situation misses so missed questions come back more often (stays in localStorage).
- **Polish:** mobile layout, a PWA so it works offline, credits and about page, and patch version on the data.
- **Launch:** post on r/smashbros and r/CrazyHand, offer each character Discord a "your fighter's page" link, and share short clip demos of the trainer on Twitter/X.

### Phase 2: Accounts and community curation (about 2–3 months)
- Supabase with Discord login (the community already lives on Discord). Progress syncs across devices, and local stats import on first login.
- **Curated punishes:** maintainers per character (verified via their Discord) set the *recommended* punish for each situation and add spacing notes. The engine's damage ranking stays as the fallback. This fixes the trainer's biggest weakness.
- **Resource submissions:** anyone can suggest a doc, sheet or video. Submissions go into a moderated queue, and approved ones merge into `resources.json` (same shape as the `manual` block in `src/data/community.ts`).
- **Matchup notes** written by each character community, with a short summary and links.

### Phase 2.5: "Ask the Coach", an assistant that only knows Smash (about 3–4 weeks, needs Phase 2 login)
**Model:** Claude Haiku 5.5 (`claude-haiku-5-5`, $0.10 / $0.50 per million tokens), at about $0.0005 per question, so 1,000 questions a day ≈ $15 a month. Self-hosting an open model was considered and rejected: an always-on GPU costs about $350–1,500 a month rented, or your own PC kept running and exposed to the internet, and small open models are weaker at the tool calling this design depends on. The tools live in `packages/core`, which doesn't depend on any model, so the model can be swapped later.

**How it stays accurate and on-topic**
- **Tools grounded in our data, not the model's memory.** The model answers by calling functions that wrap the existing engine, and must not invent frame numbers:
  - `get_move(fighter, move)`: one move's data (`frameData.json`).
  - `list_moves(fighter, category?)`
  - `punish_check(you, opponent, move, hitbox?)`: runs `punishOptions` and `grade` from `src/lib/punish.ts` and returns what punishes and the best option.
  - `oos_options(fighter)`
  - `matchup_summary(you, opponent)`: reuses the Phase 1 matchup logic.
  - `get_resources(fighter)`: `resourcesFor` from `src/data/community.ts`, giving Discords, docs and VODs.
  - `get_stats(fighter)`
  - All tools are `strict: true` Zod schemas (`betaZodTool`), driven by the SDK Tool Runner (`client.beta.messages.toolRunner`). Fighter names are resolved through a slug matcher that tolerates aliases (reuse `slugMatcher` from `scripts/scrape-resources.mjs`, moved into core).
- **Scope:** the system prompt makes it a Smash Ultimate coach only. It politely declines off-topic requests. It cites the data source and links to the relevant app page ("see Lucas vs Kirby").
- **Spacing and range caveat:** the engine is frame-only, so the system prompt has the assistant say so whenever "is X punishable" depends on range. Phase 2 curated punishes become another tool result and override the engine.

**Architecture**
- A Cloudflare Pages Function (`functions/api/coach.ts`) calls `@anthropic-ai/sdk` server-side. The API key is a Cloudflare secret, never sent to the browser. Responses stream to the UI.
- **UI:** an "Ask the Coach" panel on every page that knows the page's context. On `/characters/lucas` it starts already knowing about Lucas, and its suggested questions are things like "What beats Kirby's down smash?". Answers render links back to app pages.
- **Prompt caching:** the system prompt and tool definitions are kept fixed and cached. A short roster index sits in the cached prefix; the full frame data is never put in the prompt, since tools fetch only what's needed. Check `usage.cache_read_input_tokens` > 0 to confirm caching works.
- **Effort:** `output_config: { effort: "low" }` (Haiku 5.5 defaults to `medium`), and `max_tokens` around 2,000 per answer.
- **Refusals:** Haiku 5.5 has no server-side fallback, so check `stop_reason === "refusal"` and show a friendly "try rephrasing".

**Cost controls (you pay, so hard caps)**
1. **Login required:** the assistant only works after Discord login (Phase 2 Supabase).
2. **Per-user quota:** e.g. 20 questions a day, counted in a Supabase `coach_usage` table and checked in the Function before calling the API.
3. **Per-IP rate limit:** Cloudflare's built-in rate limiting on `/api/coach`.
4. **Monthly spend cap:** a hard limit set in the Anthropic Console, plus an app-side kill switch. The Function sums `usage` tokens per month and disables the assistant (with a friendly message) at e.g. 90% of budget.
5. **Short history:** only the last ~6 turns are sent, and conversations are capped at ~15 turns.

**Quality checks:** a small eval set of ~40 questions whose answers we know from the data (Lucas vs Kirby forward smash → forward tilt punishes; Fox's fastest OoS is the frame-6 air shine; Kazuya's jumpsquat). Run it before each prompt or model change. The claude-api skill's `build-eval` flow can set this up.

### Phase 3: Controller practice tool on the web (about 2 months)
- Navigate the trainer and answer drills with a controller via the Gamepad API (any controller connected to PC; GameCube adapter in PC mode).
- **Reaction drills:**
  1. Play the opponent move's hitbox GIF/WebM frame by frame at 60 fps.
  2. You input your punish on the controller.
  3. The app scores whether your input landed within the real frame window, and shows your reaction-time distribution.
- **Input/execution trainer:**
  - Exercises: short hop vs full hop, jump-cancel up smash or grab out of shield, double-jump-cancel aerials, wavebounce, perfect shield timing.
  - Shows a live input display, per-frame timeline, consistency %, and history graphs.
- **Honest precision note:** the browser polls about once per screen refresh (60–144 Hz). That's enough for learning, but frame-perfect measurement needs Phase 4.

### Phase 4: Desktop app with Tauri (only once Phase 3 shows demand)
- Wraps `apps/web`, so it's the same UI and the same `packages/core`.
- Native input in Rust (SDL2 / `gilrs`, plus WinUSB for the GameCube adapter): polling at up to 1000 Hz with timestamped inputs, giving frame-accurate measurement.
- Extras: an input-display overlay for OBS, offline data packs, auto-update, and global hotkeys.
- Tauri over Electron: much smaller install, and Rust is good at low-latency input. Windows first, then macOS and Linux.

### Phase 5+: Idea backlog (pick by community demand)
- **Kill % calculator** using the knockback formula, with weight and rage from the UFD stats we already scrape.
- **VOD review tool:** paste a YouTube link, add timestamped notes and tags, share a link (stored in Supabase).
- **start.gg integration:** upcoming tournaments near you, and top players per character from results. That also automates "players to watch".
- **Combo database** per character: percent ranges, video, difficulty, and whether it's a true combo.
- **Ledge trainer:** a reaction drill for the opponent's ledge options.
- **Printable matchup cheat sheets** to look at between games at a tournament.
- **Daily challenge and streaks,** opt-in leaderboards.
- **Localization:** Japanese, Spanish and French communities are huge, so translate the UI and use the community for content.
- **Patch history:** frame data diffs between versions.
- **Coach directory** (free listings only).

## Legal and data hygiene (free project)
- Follow Nintendo's Game Content Guidelines: non-commercial, donations OK, no ads or paywalls on Nintendo assets. Add a footer disclaimer ("not affiliated with Nintendo").
- Don't distribute game files. The XCI is not needed. If we ever datamine our own frame data, publish only derived numbers, never assets.
- Dragdown and SmashWiki content is CC BY-SA, so keep attribution and source links (already rendered on fighter pages).
- Discord invites are re-verified weekly by the scheduled scrape job, so dead links drop out automatically.

## Scaling notes
- Traffic: static pages on a CDN handle any spike at about $0. Supabase's free tier covers early accounts. Re-hosted media on R2 has no egress fees.
- The bus factor of a solo maintainer: open-source repo, documented scrapers, character maintainers who own content, and CI that keeps data fresh without manual work.
- Keep `packages/core` free of UI and network code. That's what lets web, desktop, the AI coach's tools, and possibly a Discord bot (e.g. `/punish kirby fsmash lucas`, which could also call the coach) all share it.
- AI cost grows with usage, not page views. The caps in Phase 2.5 keep the worst case at the budget you set. If donations grow, raise the per-user quota before considering a more expensive model.

## Critical files
- `src/lib/punish.ts`: engine. Moves to `packages/core`, gains curated-override support in Phase 2.
- `src/lib/stats.ts`: progress tracking. Becomes spaced repetition in Phase 1, syncs via Supabase in Phase 2.
- `src/pages/Trainer.tsx`: becomes a drill framework hosting several drill types.
- `src/data/community.ts`, `scripts/scrape-resources.mjs`: resource pipeline. Receives approved submissions in Phase 2.
- `scripts/scrape-ufd.mjs`, `scripts/validate-oos.ts`: data pipeline and its validation test.
- `src/App.tsx`: router replacement and prerendered routes.

## Verification (per phase)
- **Phase 0:** `pnpm test` passes (OoS validation ≥79/87 plus engine unit tests). The CI workflow is green, the deployed URL loads, and a manual scheduled-scrape run opens a data PR.
- **Phase 1:** view the prerendered HTML source of a matchup page and confirm it contains the content. Lighthouse SEO/PWA checks pass. Drills are clicked through in the browser pane. Missed situations come back more often (checked through stats in localStorage).
- **Phase 2:** Discord login works and progress appears on a second browser. A submitted link shows up in the moderation queue, and once approved appears on the fighter page.
- **Phase 2.5:**
  - The eval set passes (answers match engine output, no invented frame numbers).
  - An off-topic question is declined.
  - The second request in a conversation shows `cache_read_input_tokens` > 0.
  - Quota exhaustion and the monthly kill switch both return the friendly message.
  - The API key never appears in browser network traffic.
- **Phase 3:** a controller connected to the PC navigates the trainer. A reaction drill scores an input inside and outside the window correctly; test this with scripted gamepad events in the browser.
- **Phase 4:** the Tauri build runs and input timestamps from a GameCube adapter show sub-frame polling.

## Immediate next steps (first sessions)
1. Phase 0 restructure, tests and CI. Push to a new GitHub repo (needs your GitHub account/repo name).
2. Deploy to Cloudflare Pages (needs your Cloudflare account; a domain is optional at first).
3. Draft the outreach messages to UFD and dragdown for you to send.
