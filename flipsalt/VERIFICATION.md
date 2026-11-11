# Verification — 2026-11-11

- Rebuilt the engine from its original recovered source. Reversing the eight declared hooks reproduces the original source exactly; SHA-256 hashes and hook text are in `engine-provenance.json`.
- Both application JavaScript files pass Node syntax checks.
- Opened the public deployment in a browser and confirmed the original harbor scene, water/puddles, textured materials, original postprocessing, new bunting, lit 3D heart, and 3D Hedgey render successfully.
- Initial renderer boot and gameplay produced no browser console errors or warnings.
- Aimed at Poppy, threw a heart using E, and observed her friendship response.
- Verified the pause menu opens after interaction.

The full six-friend picnic playthrough, physical phone multitouch, and gamepad behavior have not been manually verified. These use the retained Saltline input and physics systems, with new game rules supplied by `storybook.js`.

## Paper avatars and touch movement update

- Replaced the modeled Hedgeys with the actual transparent Hedgey/wizard artwork on thin, two-sided alpha-cut planes, with smooth horizontal camera-facing rotation. Transparent padding is cropped through texture UV coordinates; original images are unchanged.
- Fixed the joystick hit-testing regression: the custom visible stick intercepted touches although Saltline listens for left-thumb movement on the canvas. Restored its zero-size floating origin and pointer-transparent ring/nub. The idle thumb hint is also pointer-transparent.
- `node tools/test-touch.mjs` executes the unchanged original Saltline input factory. Covers forward/backward and diagonal movement, simultaneous movement/look/heart/jump, finger cancellation, pause/resume, focus loss, and the CSS hit-testing contract.
- Physical iPad/Android hardware is unavailable in this session; these automated checks do not substitute for a physical-device test.
