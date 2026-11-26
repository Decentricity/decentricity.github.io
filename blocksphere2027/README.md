# Blocksphere 2027

An adaptation of [The Last Boring Slide](https://claude.ai/artifact/Cy2d8Vn63CnzCtonA1LSah#swarm-3), published at https://decentricity.github.io/blocksphere2027/.

The original was opened in the browser, returned to the first slide and played through to its closing slide. Its published iframe HTML was downloaded on 26 November 2026. The untouched full download and extracted scripts are retained locally in `/home/decentricity/blocksphere2027-research/`. The exact original engine is also archived here as `source/original-script-3.js.gz`; hashes are in `source/provenance.json`.

## How the original works

The deck renders into one WebGL 2 canvas. A shared scene controller advances timed beats and renders outgoing and incoming scenes into framebuffer textures. Each scene supplies geometry, shaders, camera positions, overlays and sound cues. A transition combines those textures with its own geometry or shader effect: portals, paper folding, washing, flaps, a slam, daybreak, a line and a tear.

The opening office scene draws apparently ordinary slides. Its canvas texture becomes the face of the rising paper chart; the tower scene moves the camera along that surface into three dimensions. Later scenes reuse the same principle with a folded boat, recursive mechanisms, instanced slide swarms, dominoes, a deforming calendar, lantern landscapes and a draggable split world. The closing wall can reuse snapshots of visited scenes.

This edition retains all thirteen original scene implementations and transition assignments, their timing, camera choreography, geometry and all 477 shader strings. It changes presentation copy, speaker notes, chapter numbering, the opening accent and the chart's labels. The chart is an illustration of scope; it no longer displays the original AI benchmark claims. Original thumbnail fallbacks are replaced by local Blocksphere chapter art. The embedded fonts, image bundle, Three.js code and original license notice are retained.

The Claude platform wrapper is omitted. Startup is deferred to the Enter button; the original engine warms nearby scenes in the background. `site.js` adds navigation, an accessible reading edition, partner profiles, project imagery, references and contact links. It does not replace the animation engine.

## Files and editing

- `assets/deck.js`: readable adapted original bundle, including Three.js and the scene engine.
- `assets/embedded.js`: unchanged original embedded fonts and image assets.
- `original.css`: original presentation UI styles.
- `site.js`, `site.css`, `index.html`: Blocksphere navigation and reading interface.
- `chapters.json`: chapter narrative, presenter notes and source references.
- `sources.json`: public profiles, publications and project sources.
- `source/copy.json`: replacements keyed to lines in the preserved readable original.
- `source/adapt.cjs`: reproducible source adaptation; uses Acorn to target literals and scene metadata.
- `source/verify.cjs`: verifies original hashes, unchanged shader strings, scene timing, transitions and reference coverage.

To rebuild after editing copy or chapters, run `npm install` and `npm run build` from `source/`, then `npm run verify`. No build step is required to serve the website. Refresh the content hashes on asset query strings in `index.html` when publishing changes to JS or CSS.

Serve the repository with a static HTTP server and open `/blocksphere2027/`. WebGL 2 is required for the animated version. The reading edition works without initializing WebGL and is the comfortable option on narrow portrait screens. Sound starts muted. Arrows/tap advance; A controls automatic advance; M toggles sound; F controls fullscreen; O shows the original overview. The toolbar exposes the primary controls.

## Content sources

Company and product information comes from blocksphere.id; project descriptions and the 37-entry archive come from portfolio.blocksphere.id. Public partner profiles cover Pandu Sastrowardoyo, Gilang Bhagaskara and Jean-Daniel Gauthier. Supporting publications include the 2020 Forkast digital-rupiah opinion piece and ABI's July 2023 Project Garuda response-paper teaser. BCA's Finhacks report and the published NobleProg collaboration provide additional public evidence. Each relevant chapter links its sources.

The 2027 section presents a direction for discussion. The animation's scale, physics demonstrations and imagined landscapes are conceptual; they are not business forecasts or promised release dates.
