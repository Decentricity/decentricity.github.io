# Anti-Camera

Anti-Camera is a prototype for a camera with no lens.

A traditional camera captures photons. Anti-Camera captures context.

It never opens the device camera and never shows a preview. When the shutter is pressed, the app takes a snapshot of the moment: GPS, time, timezone, weather, heading, tilt, motion, battery, language, viewport, indoor/outdoor state, and locally computed ambient audio descriptors. It then asks an image generator to imagine what could plausibly exist there.

The generated image is not evidence. It is not a photograph of reality. It is the machine's interpretation of reality from context alone.

## Prototype Behavior

- The interface is modeled after the back of a compact point-and-shoot camera.
- The fake viewfinder currently displays debug context. This would disappear in real hardware.
- Pressing the shutter plays a mechanical click, darkens the viewfinder, waits like instant film, then reveals a generated frame.
- Frames are kept locally in IndexedDB and displayed as a film strip.
- Metadata can be exported as JSON, including the hidden generated prompt and captured context.
- The shutter freezes a numeric camera pose immediately: azimuth, pitch, roll, screen orientation, confidence, and timestamp.

## Privacy Boundary

Anti-Camera does not access `video` or the device camera.

The microphone is used only through the Web Audio API. Raw audio is not stored and not uploaded by this prototype. The app computes local descriptors such as volume, noisiness, spectral balance, and rough speech probability. Only those numeric/contextual features are eligible to leave the browser when an external image provider is configured.

Location is intentional camera context. The app stores raw GPS coordinates and the best available reverse-geocoded place hierarchy with each generated frame, including nearby mapped feature, street, locality, city, region, country, provider, confidence, and approximate feature distance when available. This precise location context appears in JSON exports.

Precise coordinates are sent only to the configured reverse-geocoding services and to the chosen image-generation provider as part of the captured context. Anti-Camera does not add analytics or maintain an unlimited background trail of locations.

## Image Providers

The runtime uses a provider abstraction:

```ts
ImageGenerator.generate(context)
```

Included providers:

- `openai-images`: default prototype provider. The user must bring her own OpenAI API key.
- `configurable-endpoint`: server/proxy endpoint provider for production use.
- `local-context-imaginer`: explicit developer override for offline UI work.

Direct OpenAI API keys in browser storage are acceptable only for this early BYOK phase. The prototype never commits or ships a shared key. A real public deployment should use `configurable-endpoint` so secrets remain server-side.

The first shutter press asks for an OpenAI secret if one has not already been saved in the browser. It is stored in `localStorage` on that device.

## Camera Pose

Anti-Camera normalizes browser orientation into a camera-facing pose:

- `azimuthDeg`: `0` = north, `90` = east, `180` = south, `270` = west.
- `pitchDeg`: `0` = optical axis near the local horizon, positive = aimed upward, negative = aimed downward.
- `rollDeg`: `0` = level horizon. Positive roll means the camera's top edge rotates clockwise as seen by the photographer looking along the optical axis.
- `screenOrientationDeg`: the portrait/landscape device rotation used to determine the photographic frame's up edge.

The prompt builder treats pose as a strict compositional constraint. The manual focal-distance selector defaults to a `21 mm` full-frame-equivalent rectilinear lens, with additional detents for 28 mm, 35 mm, 50 mm, 80 mm, telephoto, and macro rendering.

## Manual Controls

The prototype includes five physical-style manual controls:

- Depth selector: deep focus or bokeh.
- EV dial: `-3` through `+3` exposure compensation.
- Subject mode dial: landscape, one person, group, or crowd.
- Flash lever: off or on.
- ASA / ISO dial: `80` through `1000`.

The latest manual settings are stored locally in the browser. At shutter press, Anti-Camera freezes the current settings together with camera pose, then stores those exact values in the frame metadata and JSON export. The hidden prompt treats these as physical photographic constraints rather than aesthetic tags.

For desktop prompt testing without moving a phone, append:

```text
?debugPose=1
```

This injects:

```text
azimuth=237, pitch=38.4, roll=-7.2, screenOrientation=0
```

Custom values can be passed as comma-separated numbers:

```text
?debugPose=237,38.4,-7.2,0
```

Optional local configuration from the browser console:

```js
localStorage.setItem("anticamera.provider", "openai");
localStorage.setItem("anticamera.openai.key", "sk-...");
localStorage.setItem("anticamera.openai.model", "gpt-image-2");
```

Endpoint mode:

```js
localStorage.setItem("anticamera.provider", "endpoint");
localStorage.setItem("anticamera.endpoint.url", "https://example.com/anti-camera-image");
localStorage.setItem("anticamera.endpoint.headers", JSON.stringify({ "Authorization": "Bearer ..." }));
```

The endpoint receives:

```json
{
  "prompt": "hidden internal prompt",
  "context": {
    "capturedAt": "ISO timestamp"
  }
}
```

It can return any of:

```json
{
  "imageDataUrl": "data:image/png;base64,..."
}
```

```json
{
  "b64_json": "..."
}
```

```json
{
  "url": "https://..."
}
```

## Browser Sensors to Hardware Sensors

The browser APIs are deliberately isolated so they can later be replaced by real hardware modules:

- Browser GPS -> dedicated GNSS module
- Device orientation and motion events -> IMU
- Browser battery API -> charge controller / fuel gauge
- Microphone + Web Audio descriptors -> MEMS microphone + onboard DSP
- Weather API -> network weather service or onboard connectivity service
- Indoor/outdoor toggle -> physical switch
- Browser viewport/device metadata -> hardware body metadata and firmware state

## Development

This is a static TypeScript app with no frontend framework.

```bash
npm install
npm run build
```

The build emits browser modules into `assets/`, which are loaded by `index.html` and can be served directly by GitHub Pages.

## Philosophy

Cameras usually feel objective because they record light. Anti-Camera makes that assumption strange.

It records everything around the image except the image itself, then produces a photograph-like fiction. The result should feel like using an instant film camera from a nearby future: no preview, no prompt, no chat box, just a shutter and a machine that guesses.
