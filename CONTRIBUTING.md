# Contributing

Thanks for helping make Smash Trainer better! The roadmap lives in [docs/ROADMAP.md](docs/ROADMAP.md).

## Setup

Node 22 LTS recommended.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + data tests
npm run typecheck
```

## Layout

| Path | What it is |
| --- | --- |
| `packages/core` | Punish engine and frame-data types. Pure TypeScript: no UI, network or storage code. |
| `packages/data` | Scrapers (`scripts/`), generated JSON (`generated/`), and typed loaders (`src/`). |
| `apps/web` | The React site. |

## Adding community resources

The easiest contribution: open a PR adding verified links for your main to the `manual` block in
[`packages/data/src/community.ts`](packages/data/src/community.ts). Please only add links that are public and
that you've checked yourself (Discord invites should be permanent, not 7-day invites).

## Engine changes

If you change how out-of-shield frames or punishes are computed (`packages/core/src/punish.ts`), add a test
in `packages/core/test` and make sure `packages/data/test` still passes. That suite checks the engine
against UFD's hand-curated out-of-shield lists for every fighter.

## Data sources

Frame data comes from [ultimateframedata.com](https://ultimateframedata.com). Community resources come from
[dragdown.wiki](https://dragdown.wiki) and [SmashWiki](https://www.ssbwiki.com) (CC BY-SA). Always keep
attribution. Don't commit game files or extracted game assets.
