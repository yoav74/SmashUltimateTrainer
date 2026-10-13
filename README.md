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

## Layout

- `packages/core`: punish engine + types (pure TS, shared by web, the future desktop app and AI coach)
- `packages/data`: scrapers, generated JSON, typed loaders
- `apps/web`: the React site (React Router, Vite)

## Data

```bash
npm run scrape            # frame data + portraits from ultimateframedata.com (cached in packages/data/.cache)
npm run scrape:resources  # community resources
npm run scrape:hitboxes   # hitbox tables + traction from SmashWiki (for reach)
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

### Range (`packages/core/src/reach.ts`)

A punish also has to **reach** after shield pushback. The trainer has a spacing setting: close range (default), max range (their hitbox just touched your shield), or ignore range.

- **Reach** comes from SmashWiki's per-move hitbox tables. It's exact (offset + radius) when the farthest hitbox is anchored to the character (~half of all moves, including grabs), and estimated ("≈") when it sits on a limb or weapon bone, since bone positions depend on animations that aren't public. Tether grabs and projectiles are left unknown and get the benefit of the doubt.
- **Pushback** uses Ultimate's formulas (defender `(shieldstun + 1) × 0.09`, max 1.3; attacker `damage × 0.04 + 0.025`), slowed by each fighter's traction.
- **Movement:** out-of-shield aerials drift forward (air speed and acceleration), and dash attacks travel.
- All guessed constants live in `ESTIMATE` in `reach.ts`.

**Known limits:** "best punish" ranks by raw damage (no kill power or follow-ups), bone-attached reach is an estimate, and multi-hit moves count their biggest single hit.

---
Not affiliated with Nintendo. Code is MIT-licensed; see [LICENSE](LICENSE) for data and asset attribution.
