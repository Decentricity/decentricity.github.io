# InstictFi DecenTrade (Mobile-First Prototype)

A single-page, canvas-driven demo that visualizes a live SOL-PERP orderbook mid-price on an infinite hex grid and lets users place small "tap trades" on upcoming price tiles. It pulls live data from Drift's DLOB WebSocket and renders a scrolling price trail, candlesticks, and a faux social layer of simulated bets.

## How to run
- Open `index.html` in a mobile browser (the UI intentionally blocks desktop devices).
- The app loads live data via WebSocket and the logo image from `https://instinctfi.xyz/...`.
- No build step; all logic is in `app.js` and styling in `styles.css`.

## Desktop compatibility note
The app now uses a Cloudflare Worker WebSocket proxy to fetch Drift DLOB data. This avoids browser user-agent blocking that can cause the feed to stall on desktop.

## What it does
- Live price feed: connects to Drift DLOB WebSocket and extracts mid-price from SOL-PERP orderbook updates.
- Infinite hex price ladder: every hex has a fixed price based on a frozen anchor and tick size.
- Scrolling price trail: the price line moves left over time and can "hit" selected hexes.
- Tap-to-bet: users select hexes to place bets; when the price line passes a selected hex, it settles with a payout based on leverage.
- Simulated crowd: random "other users" place yellow bets for visual dynamism.
- Responsive UX: portrait mode swaps axes (time down, price right), landscape keeps the classic left-to-right time flow.

## Architecture (high level)
- `index.html`
  - Static layout: header, canvas, trading sidebar, fullscreen button, warnings.
  - Loads Orbitron font and `app.js`.
- `styles.css`
  - Cyber/neon theme variables, responsive layout, portrait-mode layout rules.
  - UI controls styling for the sidebar, D-pad, fullscreen button.
- `app.js`
  - **Boot & safety**: error overlay, DOM setup, and global error handlers.
  - **Config + State**: constants live in `CONFIG`, runtime data in `STATE`.
  - **Data feed**: Drift DLOB WebSocket (SOL-PERP), reconnect logic, mid-price parsing.
  - **Price engine**: easing, rolling history, dynamic range for labels, candles.
  - **Hex grid + ladder**: immutable price labeling tied to world coordinates.
  - **Rendering**: draw hex grid, price trail, candles, header, offline overlay.
  - **Input**: click-to-bet, two-finger drag (viewport), D-pad pan/zoom, fullscreen.
  - **Simulated users**: random yellow bets and speech bubbles.

## Rendering flow
1. `boot()` initializes DOM, audio, and the WebSocket.
2. `requestAnimationFrame(animate)` drives the loop.
3. Each frame:
   - Update scroll position and trail history.
   - If online, update price + dynamic range.
   - Draw background logo, grid, hexes, price trail, candles, and HUD.

## Data flow
1. DLOB orderbook messages → `handleDlobMessage()`.
2. Extract mid-price → `STATE.targetPrice`.
3. `updatePrice()` eases `STATE.currentPrice` and appends history.
4. History feeds:
   - price trail and candles
   - adaptive label ranges

## Refactoring suggestions
- **Modularize `app.js`**: split into `boot`, `feed`, `render`, `input`, `trading`, and `math` modules to reduce coupling.
- **Unify portrait/landscape rendering**: shared helpers for line/hex/candle drawing would shrink duplicate logic.
- **Encapsulate coordinate transforms**: a single transform utility object would clarify world ↔ screen conversions.
- **Extract UI state from render state**: keep trading UI (balance, bets) separate from rendering state to reduce cross-effects.

## Potential bugs / improvements to consider
- **`ctx.roundRect` support**: `drawDialogBubble()` uses `roundRect`, which is missing in some mobile browsers. Add a fallback path or polyfill.
- **Touch-first betting**: only click events are handled for betting. Consider pointer/touch handlers for immediate taps, especially on iOS.
- **Reconnect on websocket error**: `onerror` relies on `onclose` to reconnect; in some browsers it may not close. Consider calling `scheduleReconnect()` in `onerror`.

## File map
- `index.html`: app shell and canvas container.
- `styles.css`: theme, layout, and responsive portrait/landscape rules.
- `app.js`: all logic (data feed, rendering, input, trading simulation).
- `wrangler.toml`: Cloudflare Worker configuration for the WS proxy.
- `src/worker.js`: WS relay from the client to Drift DLOB.
