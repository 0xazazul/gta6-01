# gta6-01 — Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/0xazazul/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/0xazazul/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is a complete open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty ($1,666 in USDC). It runs offline in a desktop browser from static files — no build step, no network at runtime. All art, story, names, characters and vehicles are original.

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and visit the local URL). Keyboard + mouse.

- **A city on foot and by car** — drive through Solmar Bay, steal cars, traffic and pedestrians share the roads.
- **Wanted level and police** — commit crimes and the police come after you; lose them to cool off.
- **Missions and a story** — a mission chain with a start, objectives and a save.
- **Combat** — on-foot and drive-by combat.
- **HUD with a minimap** — health, wanted stars, cash, mission tracker and a live minimap.

## Layout

- `main.ts` — Node 22 entry point (build/serve harness).
- `vendor/makefun-game.ts` — vendored from the make.fun kit, unchanged.
- `game/` — the static game: `index.html` + ES modules under `game/src/` (three.js 0.187.0 vendored in `game/vendor/`).
- `screenshots/` — 4 screenshots taken in a desktop browser.

## Local measurement

Screenshots verified in a desktop browser; the game plays end to end offline with no console errors and no external requests.
