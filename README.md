# Skylark Courier — a flight game over Kestrel Cay

[![make.fun competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun rank](https://make.fun/badge/best-flight-game-20261126-0057/Mastomy2/best-flight-game-20261126-0057-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun reward](https://make.fun/badge/best-flight-game-20261126-0057/Mastomy2/best-flight-game-20261126-0057-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**Skylark Courier** is an original arcade flight game: fly a little red-and-cream
prop plane, the Skylark SK-7, over the island of Kestrel Cay. Three sorties, one
airframe, and a fuel gauge that always has an opinion.

## The three sorties

- **Ring Run** — thread all 8 golden rings over the island. Each ring is worth
  100 points and refills 14% of the fuel tank.
- **Island Hop** — land on Runway 09, cross the island, and put the Skylark down
  on Runway 27. Gear down, slow under 62 m/s, gentle sink for the smooth-landing
  bonus.
- **Storm Chase** — rings appear one at a time against a 90-second clock. Each
  one is worth 150 points and adds 10 seconds. Chain five or more to win.

## Flying it

Serve `game/` with any static server (`node serve.ts`, then
http://localhost:8080) and play in desktop Chrome. No build step, no network
requests — every script, sound and pixel is a file under `game/` or generated
at run time.

- **Arrow keys** fly (Up climbs, Down descends, Left/Right bank and turn)
- **W / S** throttle up / down, **B** brake, **mouse** steers gently
- **G** landing gear, **C** cockpit / chase view, **P** pause, **R** restart,
  **M** mute, **1 / 2 / 3** pick a sortie

The flight model is arcade-true: throttle chases a target speed, bank turns
the heading, pitch trades speed for climb, and below 28 m/s the Skylark stalls
and sinks. Fuel burns with the throttle; an empty tank means a glide, and a
glide that ends anywhere but a runway ends the sortie.

## What you see

- Chase view over recognisable terrain: sea, beaches, grass fields, pine
  clusters, hills, snowcaps, two marked runways and drifting cumulus
- Cockpit view (C): a lit six-gauge panel — attitude ball, airspeed,
  altimeter, compass, fuel — plus throttle quadrant, gear/stall/fuel lamps
  and a yoke
- HUD: speed and altitude tapes, compass strip, score, fuel and hull bars,
  vertical speed, and a gold arrow pointing at the next ring or runway

## How it is built

`game/src/` splits the game into one job per file: `config.js` (tuning),
`terrain.js` (the island, rings, trees, clouds), `flight.js` (the flight
model), `input.js` (keyboard + mouse), `audio.js` (synthesised engine, wind
and chimes — no audio files), `render.js` (hand-rolled perspective projector
and the world), `hud.js` (aircraft art, cockpit, HUD, menus) and `main.js`
(the loop, screens and the autopilot that stages the screenshots).

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` with the vendored
make.fun library.

## Entry

- Competition: best-flight-game-20261126-0057 — "Make the best flight game"
- Account: @lamiaeth, payout wallet D6dyxPFeVwSXazmoGTRJHXiYuqUBCu11cFwiMubvAtmR
