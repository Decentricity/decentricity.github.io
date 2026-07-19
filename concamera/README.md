# ConCamera

ConCamera is a local semantic-overlay camera for GitHub Pages.

It captures a real photograph, analyzes the still frame locally in the browser, and renders a cyberpunk machine-vision overlay over the original pixels. It does not generate or regenerate images, and it does not require an OpenAI key.

## Local Vision Runtime

ConCamera uses transfer learning with compact pretrained browser models:

- Detector: TensorFlow.js COCO-SSD `lite_mobilenet_v2`
- Optional crop classifier: TensorFlow.js MobileNet v1 `alpha: 0.25`
- Runtime: TensorFlow.js 4.22.0, preferring WebGL with browser fallback where available
- Default confidence threshold: `50%`
- Analysis image maximum dimension: `640px`

Approximate first-load model/runtime download is roughly 8-12 MB compressed. Models load lazily, are reused across exposures, and are cached by the ConCamera service-worker model cache when browser CORS/cache behavior permits it.

## What Happens On Shutter

1. The app freezes camera pose, ConCamera overlay settings, indoor/outdoor mode, time, GPS, weather, and other context.
2. It captures a real still image from the device camera.
3. It creates an `ANALYZING` film placeholder immediately.
4. A bounded local queue analyzes the still image for visible faces and salient non-human objects.
5. The local CNN analyzer normalizes object labels and derives conservative geometric relationships.
6. The overlay renderer composites the original photograph plus labels, boxes, confidence details, relationship lines, and HUD marks according to the selected controls.
7. The composite image replaces the placeholder and is stored in the film roll with semantic metadata.

If recognition fails, ConCamera still returns the original photo with an `ANALYSIS UNAVAILABLE` overlay where possible.

## Controls

- `LENS`: weights the local vocabulary toward General, Urban, Nature, Tech, Vehicle, or Food.
- `OVERLAY`: selects Minimal, Normal, or Full overlay density.
- `MODE`: cycles Taxonomy, Semantic, Affordance, Risk, and Attention overlays.
- `REL`: shows or hides relationship connectors.
- `BOX`: shows or hides object boxes/brackets.
- `CONF`: filters detections below 30-90% confidence.
- `SCAN`: limits output to Focus, Balanced, or Survey object counts.
- `VIEW`: Live keeps the viewfinder as a camera preview; Freeze is reserved for inspection behavior and does not run heavyweight live inference in this MVP.

Live object overlays are deferred for mobile performance. Heavy CNN inference runs on captured stills, not continuously on the video stream.

## Overlay Modes

- `TAXONOMY`: labels recognized object categories such as `CAR`, `MOUSE`, `LAPTOP`, or `HEDGEHOG PLUSHIE`.
- `SEMANTIC`: emphasizes relationships such as `MOUSE NEXT TO LAPTOP` or `HEDGEHOG PLUSHIE ON TOP OF CAR`.
- `AFFORDANCE`: uses a conservative local lookup table for common uses such as `CHAIR -> SIT`, `KEYBOARD -> TYPE`, and `BOTTLE -> HOLD`.
- `RISK`: shows only locally inferable visual warnings such as `POSSIBLE VEHICLE NEARBY`, `POSSIBLE SHARP OBJECT`, or `POSSIBLE TRIP HAZARD`.
- `ATTENTION`: emphasizes the highest-salience objects.

Risk mode is visual assistance, not a safety certification system. It does not infer temperature, electrical state, toxicity, medical danger, criminal intent, or other facts not visible from local detections.

## Privacy

ConCamera is local-first:

- No photograph is sent to OpenAI or any image-generation service.
- No remote vision API is used for object recognition.
- Object recognition runs locally in the browser.
- No analytics are added.
- Object labels and frames are not transmitted remotely by ConCamera.
- Optional weather and reverse-geocoding services remain separate context services.

Completed frames store the composited image plus semantic metadata. JSON export includes overlay settings, recognized objects, object relationships, analysis provider, local timing metrics, scene summary, render version, and context.

## Storage And PWA Isolation

ConCamera has its own:

- IndexedDB database: `con-camera-db`
- frame metadata fallback key: `concamera.frames.v1`
- overlay settings key: `concamera.overlaySettings.v1`
- manifest name and scope
- service-worker app-shell cache: `con-camera-static-v1`
- service-worker model cache: `con-camera-models-v1`

This keeps it separate from `/anticamera/` and `/quasicamera/`.

## Development

```bash
npm install
npm run typecheck
npm test
```

The app is designed for GitHub Pages at:

```text
https://decentricity.github.io/concamera/
```
