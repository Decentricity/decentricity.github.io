# Decentricity 2026 Revamp — Terminal UI

First deployed interface for the 2026 Decentricity site architecture.

## What is implemented

- Cold-boot / warm-boot terminal startup sequence.
- Capability probe for WebGPU.
- Three-display selector: WORLD, HEDGEYOS, SHELL.
- WORLD and HEDGEYOS are deliberately reserved stubs for the next phases.
- SHELL is a complete mouse-aware, keyboard-aware Retraux / AS400-inspired menu system.
- Small command language: `help`, `man`, `ls`, `cd`, `pwd`, `cat`, `open`, `projects`, `families`, `timeline`, `archive`, `about`, `ui`, `world`, `desktop`, `history`, `date`, `reboot`.
- Project dossiers seeded from recent public Decentricity work plus older project lineages.
- Links into the preserved old-site archive.
- CRT scanlines and a glitch transition primitive shared by future UIs.

## Architecture rule

The terminal is only a renderer over a shared project/content graph. The future HedgeyOS desktop and WebGPU world should consume the same canonical project records rather than maintaining separate content.

## Files

- `index.html` — screen structure and display manager.
- `styles.css` — CRT, boot, selector and terminal/menu styling.
- `projects.js` — initial shared project/content graph seed.
- `app.js` — boot sequence, routing, menu interactions and command interpreter.

## Next phases

1. Normalize the complete public project graph from recent GitHub history.
2. Add HedgeyOS window-manager renderer in this directory.
3. Add the NFTMassacre-derived world renderer, gated by WebGPU capability.
4. Preserve route/state while glitch-switching among all three UIs.
