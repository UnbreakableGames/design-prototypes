# 99 Kingdoms

A top-down co-op survival prototype blending *Kingdom Two Crowns* (indirect economy, coin-drop interactions) with *99 Nights in the Forest* (tight survival around a shared campfire). Built solo in TypeScript + HTML5 Canvas.

Web first (itch.io build), with a Roblox port planned once the core loop proves fun.

## Play

Uses **Vite** for dev and build.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # outputs to dist/
npm run typecheck    # strict type check
```

### Controls

| Key | Action |
|---|---|
| `WASD` / arrows | Move |
| `Space` | Chop / pay for builds / hire / upgrade / unlock |
| `Click` or `Shift` | Attack |
| `1` / `2` / `3` | Night abilities (at the Blacksmith, when stocked) |
| `R` | Return to menu after game over |

## Loop

20-minute session = 10 nights. Each day/night:

- **Day (80s)** — chop trees, drip-pay ghost buildings to activate them, hire villagers, upgrade structures.
- **Night (40s)** — enemies pour from the portals, walls take damage, workshop repairs cost coin.
- **Dawn (4s)** — the Scribe's diary entry advances the mystery, the Blacksmith charges a restock fee, the dawn shop offers one of three upgrades.

## What's in it

- 8 building kinds (gather, tower, workshop, barracks, garrison, farm, wall, blacksmith).
- Unlimited upgrade tree (L1 → L2 → L3 on every structure, plus the campfire itself).
- Autoplay debug agent: `window.autoplay.start()` / `.diagnose()` in the browser console.
- Narrative system: POI notes + 10-night Scribe's diary.
- Procedural daily seed (UTC date).

## Itch.io build

```bash
npm run build
cd dist && zip -rq ../99kingdoms-itch.zip . && cd ..
```

Upload the resulting `99kingdoms-itch.zip` as an HTML project on itch.io with viewport 960×640. Asset paths are configured relative (`base: './'` in [vite.config.ts](vite.config.ts)) so it works inside the itch iframe.

## Project layout

```
src/
├── main.ts                # rAF loop
├── game/                  # top-level state
│   ├── Game.ts
│   ├── Clock.ts
│   ├── Waves.ts
│   ├── Upgrades.ts
│   ├── Quests.ts
│   └── Narrative.ts
├── entities/              # data + behaviour for each kind of thing in the world
│   ├── Hero.ts
│   ├── Recruit.ts
│   ├── Enemy.ts
│   ├── Station.ts
│   ├── Campfire.ts
│   ├── Consumable.ts
│   ├── Coin.ts
│   ├── FlyingCoin.ts
│   ├── Portal.ts
│   ├── POI.ts
│   ├── ResourceNode.ts
│   └── Projectile.ts
├── systems/               # cross-cutting
│   ├── Input.ts
│   ├── Render.ts
│   ├── Fog.ts
│   ├── Rng.ts
│   └── Autoplay.ts
├── ui/
│   ├── HUD.ts
│   └── Shop.ts
└── world/
    └── Map.ts
```
