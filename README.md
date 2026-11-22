# stealth-game-20261122

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/pumafelidae/stealth-game-20261122/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/pumafelidae/stealth-game-20261122/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Pasar Senja** — a night-market stealth heist. The heirloom keris of the Sari family
was stolen and sold through the night market. Slip through three zones — the stall
lane, the spice warehouse, the dock — take back the takings and the keris, and reach
the boat unseen. Guards patrol with vision cones; lamplight is dangerous, awning
shadow is safe; suspicion rises in a cone and falls when you hide, and a full meter
trips the alarm.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome:

```sh
python3 -m http.server --directory game 8080
```

No network request is made; every script, image and sound is a file under `game/` or synthesized in code.

Controls: WASD / arrows to move, Shift to sneak, E to grab loot, click to walk to a
point, P to pause.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## Files

- `game/index.html` — the page shell (canvas + status line)
- `game/src/config.js` — every tuning number and colour in one place
- `game/src/random.js` — seeded random (mulberry32), so shots repeat
- `game/src/world.js` — the three zones, suspicion, alarm, loot, lives, score
- `game/src/guards.js` — patrols, vision cones, line-of-sight tests
- `game/src/player.js` — movement, sneaking, grabbing loot
- `game/src/render.js` — top-down night-market drawing, cones, HUD, panels
- `game/src/input.js` — keyboard + pointer input
- `game/src/audio.js` — synthesized footsteps, alarm, chimes (WebAudio, no files)
- `game/src/shots.js` — the four staged screenshot scenes (?shot=start|play|alert|escape)
- `game/src/main.js` — boot, the fixed-step loop, the five screens
- `main.ts` — the entry program: copies game/ + screenshots/, writes dossier.json
