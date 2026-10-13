# Smash Trainer

A Super Smash Bros. Ultimate study tool. The core is a Tekken-style **punish trainer**: pick your fighter and an opponent (or random). An opponent move hits your shield, and you pick the punish.

## Running

```bash
npm install
npm run dev
```

> On this machine the default `node` (v26) doesn't work with the npm in the nvm folder. Use Node 23 explicitly:
> `C:\Users\yoav7\AppData\Roaming\nvm\v23.5.0\node.exe node_modules/vite/bin/vite.js`

## Data

Frame data for all 89 fighters is scraped from [ultimateframedata.com](https://ultimateframedata.com) into `src/data/frameData.json`:

```bash
npm run scrape            # parse cached pages in .cache/ufd
npm run scrape -- --fresh # re-download everything (≈2 min, rate-limited)
```

## Punish logic (`src/lib/punish.ts`)

When an attack hits your shield at **-N**, you have N frames. An option punishes if its out-of-shield frame is ≤ N:

| Option | OoS frame |
| --- | --- |
| Up B, Up Smash | startup |
| Aerials, air specials | startup + 3 (jumpsquat; Kazuya: 7) |
| Shield grab | startup + 4 |
| Everything else | startup + 11 (shield drop) |

The fastest computed option matches UFD's hand-curated OoS list for 79/87 fighters. The rest are Mii custom moves, items, or cases where UFD leaves out grab.

**Known limits (next steps):** spacing/range isn't modeled, "best punish" ranks by raw damage (no kill power or follow-ups), and multi-hit moves count their biggest single hit.

## Community links

Add Discord invites and highlight videos per fighter in `src/data/community.ts`.
