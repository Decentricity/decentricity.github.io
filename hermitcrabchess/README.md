# Hermit Crab Chess

Static prototype for `https://decentricity.github.io/hermitcrabchess/`.

## Library evaluation

- `shaack/cm-chessboard`: best fit among the public board libraries. It is ES6, responsive, SVG-rendered, dependency-free, and supports click or drag move input. I did not use it for this MVP because Hermit Crab Chess needs custom attach targets, shell badges, and variant move generation anyway.
- `justinfagnani/chessboard-element`: clean web-component board with no jQuery. Shadow DOM makes quick custom square/badge styling less direct for this prototype.
- `oakmac/chessboard2`: dependency-free modern chessboard.js successor, but the custom DOM board was faster to ship than adapting its API.
- `jhlywa/chess.js`: useful reference for standard chess concepts, but not used because it would reject or overconstrain legal Hermit Crab king-shell moves.

No Stockfish, minimax, bot, engine analysis, or AI opponent is included.

## MVP rules implemented

- Standard chess starting position.
- Local two-player hotseat.
- Castling disabled.
- En passant disabled.
- Pawns auto-promote to queens.
- Unshelled kings use normal check and checkmate rules.
- A king can attach an adjacent allied non-king piece. Attaching consumes the turn, removes that piece, and stores the piece type as the shell.
- A checked unshelled king may attach a shell to escape into Hermit Crab Mode.
- Shelled kings move only like the shell piece and ignore check/checkmate.
- Shelled kings can be captured directly; direct capture ends the game.
- MVP rule: shell replacement is omitted. Once a king has a shell, it cannot attach another piece.
- Clicking a shelled king twice enters unshelling mode. The shell piece may land on a legal square for that piece; the king stays behind unshelled.
- Unshelling consumes the turn and is only legal if the newly unshelled king is not in check.

## Local testing

Open `index.html` directly, or serve the repo with a static server and visit `/hermitcrabchess/`.

For PWA testing, use a local static server or GitHub Pages so `manifest.webmanifest` and `service-worker.js` are served over HTTP(S). Direct `file://` opening still works for gameplay, but service worker registration is skipped.

The page includes a `Test setup` selector for manual checks such as knight shell movement, bishop/rook/queen shell movement, pawn shell direction, direct shelled-king capture, and unshelled checkmate.
