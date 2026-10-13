# Smash Trainer

A free, open-source Super Smash Bros. Ultimate improvement hub. The core is a Tekken-style **punish trainer**: pick your fighter and an opponent (or random). An opponent move hits your shield, and you pick the punish. There are also frame data, portraits and hitbox GIFs for all 89 fighters, and per-fighter community resources (verified Discords, guides, players to watch, VOD archives).

Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md) · Contributing: [CONTRIBUTING.md](CONTRIBUTING.md)

## Running

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build
```

> Local note: on this machine the default `node` (v26) doesn't work with the npm in the nvm folder. Either run `nvm use 22` (install with `nvm install 22` first) or call Node 23 directly: `C:\Users\yoav7\AppData\Roaming\nvm\v23.5.0\node.exe node_modules/vite/bin/vite.js apps/web`.

## Layout

- `packages/core`: punish engine + types (pure TS, shared by web, the future desktop app and AI coach)
- `packages/data`: scrapers, generated JSON, typed loaders
- `apps/web`: the React site (React Router, Vite)

## Data

```bash
npm run scrape            # frame data + portraits from ultimateframedata.com (cached in packages/data/.cache)
npm run scrape:resources  # community resources
```

A GitHub Actions workflow re-runs both weekly and opens a PR when anything changes.

- **Frame data**: [ultimateframedata.com](https://ultimateframedata.com), all 89 fighters. Portraits are UFD's character art, saved to `apps/web/public/portraits`.
- **Discord**: invites from [SmashWiki's character Discord table](https://www.ssbwiki.com/Discord), each checked against Discord's invite API so only live invites are kept.
- **Docs, sheets, videos, players to watch**: [dragdown.wiki](https://dragdown.wiki/wiki/SSBU/Resources) `SSBU/<Fighter>/Resources` pages, with real titles resolved for unlabeled links.
- **Tournament VODs**: [Smash Archives](https://smasharchives.com).

## Punish logic (`packages/core/src/punish.ts`)

When an attack hits your shield at **-N**, you have N frames. An option punishes if its out-of-shield frame is ≤ N:

| Option | OoS frame |
| --- | --- |
| Up B, Up Smash | startup |
| Aerials, air specials | startup + 3 (jumpsquat; Kazuya: 7) |
| Shield grab | startup + 4 |
| Everything else | startup + 11 (shield drop) |

The test suite checks the fastest computed option against UFD's hand-curated OoS list: it matches for 79/87 fighters. The rest are Mii custom moves, items, or cases where UFD leaves out grab.

**Known limits:** spacing/range isn't modeled, "best punish" ranks by raw damage (no kill power or follow-ups), and multi-hit moves count their biggest single hit.

---
Not affiliated with Nintendo. Code is MIT-licensed; see [LICENSE](LICENSE) for data and asset attribution.
