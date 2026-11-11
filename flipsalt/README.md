# Flipsalt · A Little Love Ashore

An adaptation of the **actual Saltline engine**, not a new renderer. Published at https://decentricity.github.io/flipsalt/ .

The original Three.js runtime, render factory (`ov`), full postprocessing/shader chain, shadows, sky, procedural textures (`lv`), harbor geometry (`Pg`), background (`Iv`), ground/water (`Vg`), physics/navigation (`v_`), player camera/movement (`xE`), input (`gE`), audio (`cE`), and frame loop are retained. No new renderer is created by the adaptation.

`storybook.js` provides new weapon/friend/HUD/game modules and art direction. Fire throws a lit, three-dimensional pink heart. Original enemy and weapon factories are bypassed; the damage handler is disabled. Hedgeys use Decentricity’s actual transparent illustrations on thin, alpha-cut paper planes. Their feet remain on the ground and their bodies smoothly turn toward the player; both sides remain visible. They receive the original engine’s lighting and cast silhouette shadows. The existing industrial harbor receives pastel paint, flowers, bunting, warm light, and new signs while preserving its geometry and textured, cinematic rendering.

## Reproducible engine provenance

`upstream/saltline.original.js` is the exact recovered bundle from the original artifact, retained as the baseline. `tools/build-engine.py` inserts eight small hooks and verifies that reversing those hooks reproduces the original source byte-for-byte. It does not edit any renderer, shader, water, geometry, input, physics, or movement function. `engine-provenance.json` records the hashes and every change.

```sh
python3 tools/build-engine.py
node --check storybook.js
node --check saltline.engine.js
node tools/test-touch.mjs
```

## Controls

WASD moves, mouse looks, click/E throws a heart, Space jumps, Shift strolls faster, and Escape pauses. Saltline’s touch and controller support is preserved; its touch fire button is relabeled as a heart, and combat-only buttons are hidden. The original mouse-capture fallback is also retained. On touch screens, start a left-thumb drag anywhere on the left side; the floating joystick appears beneath the thumb. Its visuals pass touches through to Saltline’s canvas, while the heart and jump buttons remain interactive.

Aim at a Hedgey within 14 meters, with a clear line of sight, to reveal their name. A heart befriends them once; further hearts receive more happy reactions. Befriend six to unlock a seaside picnic. Settings and friendships are stored locally under `flipsalt.story.v1`, separately from both previous games. No backend is required.

## Credits

Original Saltline engine and game: Felix, https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp . Original upstream license status is recorded in the recovered starter; no new ownership of upstream code is claimed. Storybook adaptation and Hedgey artwork: Decentricity. The original `/saltline/` and the independently implemented `/flipsidehearts/` are preserved separately.
