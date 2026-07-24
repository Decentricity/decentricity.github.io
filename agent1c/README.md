# Agent1c Landing Page

Static landing page for `https://decentricity.github.io/agent1c/`.

## Sources Inspected

- `https://github.com/agent1c-ai/agent1c-ai.github.io`
- `README.md`, `SOLANA.md`, `TOOLS.md`
- `index.html`
- `js/agent1cintro.js`
- `js/agent1c-instance-profiles.js`
- `js/agent1crelay.js`
- Live `https://agent1c.ai`
- Live `https://agent1c.me`
- Existing Hitomi landing page at `https://hitomi.love`
- Destination repo conventions in `decentricity.github.io`

## Media Created

Screenshots:

- `assets/screenshots/agent1c-desktop-hero.webp`
- `assets/screenshots/agent1c-behavior-docs.webp`
- `assets/screenshots/agent1c-browser-relays.webp`
- `assets/screenshots/agent1c-theme-greenscreen.webp`
- `assets/screenshots/agent1c-mobile-workspace.webp`
- `assets/screenshots/hitomi-docs-detail.webp`
- `assets/screenshots/behavior-docs-detail.webp`
- `assets/screenshots/relay-setup-detail.webp`
- `assets/screenshots/agent1c-og.webp`

Video loops:

- `assets/video/agent1c-desktop-loop.webm`
- `assets/video/agent1c-desktop-loop.mp4`
- `assets/video/agent1c-docs-loop.webm`
- `assets/video/agent1c-docs-loop.mp4`
- `assets/video/agent1c-relay-loop.webm`
- `assets/video/agent1c-relay-loop.mp4`

## Capture Procedure

The current Agent1c source was cloned locally and served from Debian proot:

```sh
git clone --depth 1 https://github.com/agent1c-ai/agent1c-ai.github.io.git /data/data/com.termux/files/home/tmp/agent1c-ai-capture
proot-distro login debian -- bash -lc 'cd /data/data/com.termux/files/home/tmp/agent1c-ai-capture && python3 -m http.server 8011 --bind 127.0.0.1'
```

Browser automation used Debian proot Chromium with `puppeteer-core` installed in a temporary tools directory:

```sh
mkdir -p /data/data/com.termux/files/home/tmp/agent1c-capture-tools
proot-distro login debian -- bash -lc 'cd /data/data/com.termux/files/home/tmp/agent1c-capture-tools && npm init -y && npm install puppeteer-core'
```

The capture script opened `http://127.0.0.1:8011/`, created a disposable local vault with a fake passphrase, inserted sample text into `SOUL.md`, `TOOLS.md`, `heartbeat.md`, Chat, and Events, arranged product windows, and captured PNG screenshots. No production login, paid model call, live AI prompt, real wallet, key, token, or credential was used.

## Optimization Commands

Screenshots were converted with ImageMagick:

```sh
magick raw.png -strip -quality 82 output.webp
magick raw.png -crop 560x360+40+390 -resize 760x489 -strip -quality 84 detail.webp
```

Video loops were encoded in Debian proot with muted WebM and MP4 fallbacks:

```sh
proot-distro login debian -- bash -lc 'cd /data/data/com.termux/files/home/decentricity.github.io && ffmpeg -y -loop 1 -framerate 12 -t 4 -i raw.png -vf "scale=960:-2,format=yuv420p" -an -c:v libvpx-vp9 -deadline good -cpu-used 4 -b:v 0 -crf 42 agent1c/assets/video/name.webm'
proot-distro login debian -- bash -lc 'cd /data/data/com.termux/files/home/decentricity.github.io && ffmpeg -y -loop 1 -framerate 12 -t 4 -i raw.png -vf "scale=960:-2,format=yuv420p" -an -c:v libx264 -preset veryfast -crf 30 -movflags +faststart agent1c/assets/video/name.mp4'
```

Termux host `ffmpeg` failed with a `libplacebo` symbol error during this run, so Debian proot ffmpeg was used.

## Staged Capture State

The screenshots are genuine local Agent1c/HedgeyOS UI captures, but several visible states were staged locally for promotion:

- A fake local vault passphrase was submitted to unlock the workspace.
- Demo copy was inserted into behavior documents.
- Demo chat and event text was inserted in the local browser session.
- Product windows were positioned for legible screenshots.
- A green-screen theme was applied through local theme state.
- The browser/relay screenshot shows direct URL behavior and explicit relay setup rather than claiming arbitrary embedded browsing.

These changes were not committed to the Agent1c product repo.

## Claims Intentionally Omitted

The page does not publish:

- Download counts, subscriber counts, fake usage counts, testimonials, or enterprise logos.
- Pricing or quota numbers.
- Absolute privacy guarantees.
- Unrestricted autonomous browsing claims.
- Claims that Hitomi can control arbitrary websites or devices.
- Claims that wallet-aware tooling can sign, approve, swap, or move funds.
- Claims that planned Chrome extension, sync, or cloud proxy work is currently shipped.
