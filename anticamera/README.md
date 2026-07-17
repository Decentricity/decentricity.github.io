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

## Privacy Boundary

Anti-Camera does not access `video` or the device camera.

The microphone is used only through the Web Audio API. Raw audio is not stored and not uploaded by this prototype. The app computes local descriptors such as volume, noisiness, spectral balance, and rough speech probability. Only those numeric/contextual features are eligible to leave the browser when an external image provider is configured.

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
