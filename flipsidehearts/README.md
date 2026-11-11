# Flipside · Little Hearts

A standalone cozy first-person Cubewalker game by Decentricity. Walk over all six faces of a floating garden cube, send hearts to six Hedgey friends, and join their picnic.

Published at https://decentricity.github.io/flipsidehearts/ . All application assets are relative to this directory. Google Fonts are optional; no accounts, backend, analytics, or external game runtime are required.

## Play

Press **Let’s wander**. WASD or arrow keys move; the mouse looks around; click, E, or Space sends a heart. Hold Shift for a slightly quicker stroll. Escape pauses. Touch devices have a movement joystick, drag-to-look, and a heart button. Cross any cube edge to explore the next garden.

Aim at a nearby Hedgey until its name appears, then send a heart. Befriend all six to unlock **Join the picnic**. Hearts are unlimited, and the game has no combat, damage, time limit, or failure state.

Settings include sound, sensitivity, and reduced-motion face transitions. Friendships and settings use `flipsidehearts.v1` in browser-local storage; the game remains playable when storage is unavailable. New Game resets this game's friendships only.

## Development

Serve this directory with any static HTTP server. `game.js` owns scene construction, first-person controls, character interactions, audio, and UI. `cube.js` contains the pure cube-surface transport math.

```sh
node --experimental-default-type=module cube.test.mjs
node --check game.js
```

Art: original Hedgey illustrations from Decentricity’s site, copied into `assets/`. Inspired by [Flipside](https://flipside.ink) and its Cubewalker edition. Three.js r170 is bundled locally under its MIT license; see `vendor/THREE-LICENSE.txt`.

The game contains no Saltline engine or fallback. The existing `/saltline/` game is a separate deployment.
