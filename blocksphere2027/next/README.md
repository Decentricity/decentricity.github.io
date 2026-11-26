# Blocksphere — Built on experience. Built with you.

Public presentation: https://decentricity.github.io/blocksphere2027/next/

Nine newly authored WebGL scenes use the downloaded Claude artifact's existing engine. This is a separate presentation; the earlier 13-scene adaptation remains at `/blocksphere2027/`.

## What was reused

`engine.js` retains the previous bundle up to its boot boundary, including Three.js, render-target management, adaptive resolution, typography, beat scheduling, audio and shader/geometry transitions. `source/build-engine.cjs` replaces only that final boot call with the explicit `ArchiveEngine` adapter. The untouched original is archived in the parent presentation's `source/` directory. Original attribution and the embedded Three.js license are retained. The bridge exposes `create`, `THREE`, `audio`, and `transitions`.

`scenes.js` authors new worlds: the document table, chronological archive, client gallery, gold/ledger infrastructure, three traceability/privacy dioramas, product desk, partner portraits, assembly worktable and closing project document. It uses the engine's rendering context and post-processing. The original thirteen scene definitions remain in the donor bundle but are not registered or played by this presentation.

## Author another presentation

1. Copy this presentation folder to a new route, keeping its relative dependency paths valid. Keep the original archived source and attribution.
2. Edit `content.js`: each chapter has a stable lowercase alphabetic ID, title, label, duration, transition, 2–4 `[heading, narrative]` beats, source IDs and optional portfolio project IDs. Use actual source records for claims. The reading edition and presenter captions share this content.
3. Write a scene builder in `scenes.js`. Use `stage(ctx)` for the studio, lights, render target, camera and post-processing, or supply a different environment. `ctx.THREE` is the exact Three.js copy used by the donor engine; do not load another copy.
4. Return an update function accepting the original beat state. `state.k(beat,start,end)` is an eased 0–1 value; derive transformations from these values so backward navigation works. Register the builder by chapter ID. Add asynchronous image loads to the stage's pending list.
5. Each registered definition exposes `create(ctx)`, returning `init`, `update`, `render` and `resize`. Scene render calls must target the supplied framebuffer, not the screen. The engine composites it with the next scene for transitions.
6. Keep content legible outside the canvas. The reading edition, source panels and contact choices remain available without WebGL. Long evidence belongs in the reading edition; short captions accompany the action.
7. Serve from the repository root using a static HTTP server. Check representative transitions, backward navigation, direct chapter links, narrow-screen reading and the final collaboration choices. Refresh asset query versions after edits.

Rebuild only after changing the donor/adapter: `node source/build-engine.cjs`.
Validate content and preservation: `node source/verify.mjs`.

## Controls and timing

Enter opens the WebGL presentation. Left/right arrows, the bottom controls or canvas taps move through beats. `A` toggles autoplay, `M` toggles optional sound, `Home` returns to the opening. Chapter buttons support nonlinear discussion. Opening a reading panel pauses autoplay; closing it restores the prior state. Contact choices open prefilled email drafts and never send mail automatically.

The script contains 410 seconds of scene beats, plus the original transition durations. Autoplay therefore runs roughly seven minutes. Audio starts muted. On narrow devices or with reduced motion, the reading edition is recommended and the animation starts only after an explicit choice.

## Evidence and visual conventions

The refreshed portfolio snapshot contains 37 engagements and 16 featured projects. The user confirmed that the listed organizations are clients served. Descriptions preserve distinctions between implementation, consultation, feasibility and training. Confidential records retain their public labels. Product imagery and portraits are actual source assets; the 3D models are explanatory illustrations, not screenshots or measured performance claims. Sources are linked beside the relevant chapter in the reading edition.

## QA

Add `?inspect` to expose an on-page frame-rate/p95 frame-time readout. It uses local requestAnimationFrame timings and sends no telemetry. Report the browser/viewport used; measurements in an automated browser are not promises for other hardware. Adaptive resolution comes from the retained engine.

Publish working increments to `gh-pages`, under this folder. No backend, new framework or external build service is required.
