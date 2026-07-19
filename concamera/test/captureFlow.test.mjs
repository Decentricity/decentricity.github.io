import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { DEFAULT_MANUAL_SETTINGS } from "../assets/context/manualSettings.js";
import { ManualControls } from "../assets/ui/manualControls.js";
import { AntiCameraApp } from "../assets/ui/app.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("app starts without an API key and keeps debug hidden by default", async () => {
  const harness = await createAppHarness();
  await harness.app.start();

  assert.equal(harness.gallery.loadCalls, 1);
  assert.equal(harness.context.startPassiveCalls, 1);
  assert.equal(harness.debugPanel.hidden, true);
  assert.equal(harness.viewfinder.getAttribute("aria-expanded"), "false");
  assert.match(harness.readout.textContent, /Lens:GENERAL/);
  assert.match(harness.readout.textContent, /Overlay:NORM/);
  assert.match(harness.readout.textContent, /Source transmitted:NO/);
  assert.equal(harness.document.getElementById("openai-key"), null);
});

test("shutter creates an ANALYZING placeholder immediately and completes a local overlay frame", async () => {
  const sourceGate = deferred();
  const harness = await createAppHarness({
    sourceResults: [sourceGate.promise]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.gallery.placeholders.length === 1);
  const placeholderId = harness.gallery.placeholders[0].id;
  assert.equal(harness.gallery.visibleTextFor(placeholderId), "ANALYZING");
  assert.equal(harness.shutterSound.plays, 1);
  assert.equal(harness.overlayRenderer.calls.length, 0);

  sourceGate.resolve(sourcePhoto("held-source"));
  await harness.waitForFrameCount(1);

  const frame = harness.gallery.itemsById.get(placeholderId).frame;
  assert.equal(frame.provider, "local-semantic-overlay");
  assert.equal(frame.imageDataUrl, "data:image/png;base64,overlay-1");
  assert.equal(frame.context.conCamera.sourceImageTransmitted, false);
  assert.equal(frame.context.conCamera.objectAnalysisProvider, "local-cnn:test");
  assert.equal(frame.context.conCamera.renderVersion, "semantic-overlay-v1");
  assert.deepEqual(frame.context.conCamera.recognizedObjects.map((object) => object.label), ["hedgehog plushie", "car"]);
  assert.deepEqual(frame.context.conCamera.objectRelationships, [
    { subject: "hedgehog plushie", predicate: "on-top-of", object: "car" }
  ]);
  assert.equal(harness.latestFrame.src, "data:image/png;base64,overlay-1");
  assert.equal(harness.shutter.disabled, false);
});

test("rapid captures remain ordered, bounded, and use individually frozen settings", async () => {
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const harness = await createAppHarness({
    overlayResults: [first.promise, second.promise, third.promise]
  });
  await harness.app.start();

  harness.clickShutter();
  harness.click(harness.root.querySelector("[data-domain='tech']"));
  harness.click(harness.root.querySelector("[data-confidence='80']"));
  harness.clickShutter();
  harness.click(harness.root.querySelector("[data-domain='food']"));
  harness.click(harness.root.querySelector("[data-confidence='30']"));
  harness.click(harness.root.querySelector("[data-scan-mode='focus']"));
  harness.clickShutter();

  await harness.waitFor(() => harness.gallery.placeholders.length === 3);
  assert.deepEqual(harness.gallery.placeholders.map((placeholder) => harness.gallery.visibleTextFor(placeholder.id)), [
    "ANALYZING",
    "ANALYZING",
    "ANALYZING"
  ]);
  assert.equal(harness.shutterSound.plays, 3);
  await harness.waitFor(() => harness.overlayRenderer.calls.length === 1);
  assert.equal(harness.overlayRenderer.maxActive, 1);
  const originalOrder = harness.gallery.frameOrder();

  first.resolve(renderedFrame("one"));
  await harness.waitFor(() => harness.gallery.completed.length === 1 && harness.overlayRenderer.calls.length === 2);
  assert.deepEqual(harness.gallery.frameOrder(), originalOrder);

  second.resolve(renderedFrame("two"));
  await harness.waitFor(() => harness.gallery.completed.length === 2 && harness.overlayRenderer.calls.length === 3);
  third.resolve(renderedFrame("three"));
  await harness.waitForFrameCount(3);

  assert.deepEqual(harness.gallery.frameOrder(), originalOrder);
  assert.deepEqual(harness.overlayRenderer.calls.map((call) => call.settings.domain), ["general", "tech", "food"]);
  assert.deepEqual(harness.overlayRenderer.calls.map((call) => call.settings.confidenceThreshold), [0.5, 0.8, 0.3]);
  assert.deepEqual(harness.objectAnalyzer.calls.map((call) => call.settings.scanMode), ["balanced", "balanced", "focus"]);
  assert.equal(harness.overlayRenderer.maxActive, 1);
});

test("object-analysis failure is nonfatal and still produces an overlay frame", async () => {
  const harness = await createAppHarness({
    objectResults: [new Error("model unavailable")]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitForFrameCount(1);

  const frame = harness.gallery.completed[0];
  assert.equal(frame.imageDataUrl, "data:image/png;base64,overlay-1");
  assert.equal(frame.context.conCamera.sourceImageTransmitted, false);
  assert.match(frame.context.conCamera.objectAnalysisWarnings.join(" "), /model unavailable/);
  assert.equal(frame.context.conCamera.recognizedObjects, undefined);
});

test("overlay-render failure falls back to the original source photo", async () => {
  const harness = await createAppHarness({
    overlayResults: [new Error("canvas failed")]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitForFrameCount(1);

  const frame = harness.gallery.completed[0];
  assert.equal(frame.imageDataUrl, "data:image/jpeg;base64,source-1");
  assert.equal(frame.context.conCamera.renderVersion, "source-photo-fallback");
  assert.match(frame.analysisError, /canvas failed/);
});

test("still-capture failure leaves an exact failed film frame with an error number when present", async () => {
  const harness = await createAppHarness({
    sourceResults: [new Error("Camera capture failed: 404 no frame")]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.gallery.placeholders.length === 1 && harness.gallery.placeholders[0].status === "error");

  const id = harness.gallery.placeholders[0].id;
  assert.match(harness.gallery.visibleTextFor(id), /EXPOSURE FAILED/);
  assert.match(harness.gallery.visibleTextFor(id), /ERROR 404/);
  assert.equal(harness.overlayRenderer.calls.length, 0);
  assert.equal(harness.shutter.disabled, false);
});

test("queue continues across Film view switches and after a failed overlay job", async () => {
  const first = deferred();
  const harness = await createAppHarness({
    overlayResults: [first.promise, new Error("render failed: 598"), renderedFrame("recovered")]
  });
  await harness.app.start();

  harness.clickShutter();
  harness.clickShutter();
  harness.clickShutter();
  await harness.waitFor(() => harness.overlayRenderer.calls.length === 1);
  harness.clickViewToggle();
  assert.equal(harness.appShell.dataset.view, "film");

  first.resolve(renderedFrame("first"));
  await harness.waitForFrameCount(3);

  assert.equal(harness.appShell.dataset.view, "film");
  assert.equal(harness.gallery.completed.length, 3);
  assert.equal(harness.gallery.completed[1].imageDataUrl, "data:image/jpeg;base64,source-2");
  assert.equal(harness.gallery.completed[2].imageDataUrl, "data:image/png;base64,overlay-recovered");
  harness.clickViewToggle();
  assert.equal(harness.appShell.dataset.view, "camera");
});

test("debug panel and camera switch continue to work in the local overlay build", async () => {
  const harness = await createAppHarness();
  await harness.app.start();

  harness.clickViewfinder();
  assert.equal(harness.debugPanel.hidden, false);
  assert.equal(harness.liveCamera.startCalls, 1);
  harness.key("Escape");
  assert.equal(harness.debugPanel.hidden, true);

  assert.equal(harness.cameraSwitch.getAttribute("aria-label"), "Switch to front camera");
  harness.clickCameraSwitch();
  await harness.waitFor(() => harness.liveCamera.toggleCalls === 1);
  assert.equal(harness.cameraSwitch.dataset.cameraFacing, "user");
  assert.equal(harness.cameraSwitch.getAttribute("aria-label"), "Switch to rear camera");
});

async function createAppHarness(options = {}) {
  const { document, window } = parseHTML(html);
  installDomGlobals(document, window);
  const root = document.getElementById("manual-controls");
  const manualControls = new ManualControls(root);
  const context = new FakeContext(manualControls);
  const liveCamera = new FakeLiveCamera(options.sourceResults);
  const faceAnalyzer = new FakeFaceAnalyzer(options.faceResults);
  const objectAnalyzer = new FakeObjectAnalyzer(options.objectResults);
  const overlayRenderer = new FakeOverlayRenderer(options.overlayResults);
  const shutterSound = new FakeShutterSound();
  const gallery = new FakeGallery();
  const latestFrame = document.getElementById("latest-frame");
  installInstantImage(latestFrame);

  const app = new AntiCameraApp(
    document.getElementById("app-shell"),
    document.getElementById("camera-view"),
    document.getElementById("film-view"),
    document.getElementById("view-toggle"),
    document.getElementById("viewfinder"),
    document.getElementById("camera-switch"),
    document.getElementById("debug-panel"),
    document.getElementById("context-readout"),
    document.getElementById("developing"),
    document.getElementById("instant-reveal"),
    latestFrame,
    document.getElementById("battery-fill"),
    document.getElementById("battery-label"),
    document.getElementById("shutter"),
    document.querySelectorAll("input[name='scene-mode']"),
    manualControls,
    gallery,
    {
      context,
      liveCamera,
      faceAnalyzer,
      objectAnalyzer,
      overlayRenderer,
      shutterSound,
      delay: async () => undefined,
      minimumAnalyzingTime: () => 0,
      maxConcurrentAnalyses: 1,
      maxQueuedCaptures: 10
    }
  );

  return {
    app,
    document,
    window,
    root,
    context,
    liveCamera,
    faceAnalyzer,
    objectAnalyzer,
    overlayRenderer,
    shutterSound,
    gallery,
    manualControls,
    latestFrame,
    appShell: document.getElementById("app-shell"),
    readout: document.getElementById("context-readout"),
    viewfinder: document.getElementById("viewfinder"),
    cameraSwitch: document.getElementById("camera-switch"),
    debugPanel: document.getElementById("debug-panel"),
    shutter: document.getElementById("shutter"),
    click(element) {
      element.dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    clickShutter() {
      document.getElementById("shutter").dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    clickViewfinder() {
      document.getElementById("viewfinder").dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    clickViewToggle() {
      document.getElementById("view-toggle").dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    clickCameraSwitch() {
      document.getElementById("camera-switch").dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    key(keyName) {
      document.dispatchEvent(keyboardEvent(window, keyName));
    },
    async waitFor(predicate, timeoutMs = 800) {
      await waitFor(predicate, timeoutMs);
    },
    async waitForFrameCount(count) {
      await waitFor(() => gallery.completed.length === count, 1_000);
    }
  };
}

function installDomGlobals(document, window) {
  globalThis.window = window;
  globalThis.document = document;
  globalThis.localStorage = fakeStorage();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      vibrate() {
        return true;
      }
    }
  });
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.Event = window.Event;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  window.setInterval = () => 0;
  window.clearInterval = () => undefined;
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href: "http://localhost/concamera/",
      search: ""
    }
  });
}

function keyboardEvent(window, keyName) {
  const event = new window.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: keyName });
  return event;
}

function installInstantImage(image) {
  let src = "";
  Object.defineProperty(image, "src", {
    configurable: true,
    get() {
      return src;
    },
    set(value) {
      src = String(value);
      Object.defineProperty(image, "complete", { configurable: true, value: true });
      Object.defineProperty(image, "naturalWidth", { configurable: true, value: 640 });
      queueMicrotask(() => image.onload?.());
    }
  });
}

class FakeContext {
  startPassiveCalls = 0;
  primeCalls = 0;
  snapshots = [];
  poseCounter = 0;

  constructor(manualControls) {
    this.manualControls = manualControls;
  }

  async startPassiveCollection() {
    this.startPassiveCalls += 1;
  }

  async primeFromUserGesture() {
    this.primeCalls += 1;
  }

  freezeCameraPose() {
    this.poseCounter += 1;
    return {
      azimuthDeg: 237,
      pitchDeg: 4,
      rollDeg: -2,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt: Date.parse("2026-07-17T03:03:00.000Z") + this.poseCounter
    };
  }

  async snapshot(mode = "outdoor", frozenPose, frozenSettings = this.manualControls.currentSettings()) {
    const pose = frozenPose ?? this.freezeCameraPose();
    const context = contextFixture(mode, pose, frozenSettings);
    this.snapshots.push(context);
    return context;
  }
}

class FakeLiveCamera {
  captures = [];
  toggleCalls = 0;
  startCalls = 0;
  facingMode = "environment";
  nextSourceIndex = 1;
  constructor(sourceResults = []) {
    this.sourceResults = [...sourceResults];
  }

  async start() {
    this.startCalls += 1;
  }

  async captureStill() {
    const index = this.nextSourceIndex;
    this.nextSourceIndex += 1;
    const result = this.sourceResults.length > 0 ? this.sourceResults.shift() : sourcePhoto(`source-${index}`);
    const resolved = await resolveMaybe(result);
    if (resolved instanceof Error) {
      throw resolved;
    }
    this.captures.push(resolved);
    return resolved;
  }

  currentStatus() {
    return { state: "ready", message: "CAMERA READY" };
  }

  async toggleCamera() {
    this.toggleCalls += 1;
    this.facingMode = this.facingMode === "environment" ? "user" : "environment";
    return this.facingMode;
  }

  currentFacingMode() {
    return this.facingMode;
  }
}

class FakeFaceAnalyzer {
  calls = [];

  constructor(results = []) {
    this.results = [...results];
  }

  async analyze(source) {
    this.calls.push(source);
    const result = this.results.length > 0 ? this.results.shift() : {
      faces: [{
        id: "face-1",
        boundingBox: { x: 0.2, y: 0.2, width: 0.2, height: 0.22 },
        confidence: 0.9,
        areaRatio: 0.04,
        centerDistance: 0.1
      }],
      count: 1,
      provider: "face:test"
    };
    const resolved = await resolveMaybe(result);
    if (resolved instanceof Error) {
      throw resolved;
    }
    return resolved;
  }
}

class FakeObjectAnalyzer {
  calls = [];

  constructor(results = []) {
    this.results = [...results];
  }

  async analyze(source, settings) {
    this.calls.push({ source, settings: { ...settings } });
    const result = this.results.length > 0 ? this.results.shift() : objectAnalysisFixture();
    const resolved = await resolveMaybe(result);
    if (resolved instanceof Error) {
      throw resolved;
    }
    return resolved;
  }
}

class FakeOverlayRenderer {
  calls = [];
  active = 0;
  maxActive = 0;

  constructor(results = []) {
    this.results = [...results];
  }

  async render(input) {
    this.calls.push({
      source: input.source,
      settings: { ...input.settings },
      analysis: input.analysis
    });
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      const result = this.results.length > 0 ? this.results.shift() : renderedFrame(String(this.calls.length));
      const resolved = await resolveMaybe(result);
      if (resolved instanceof Error) {
        throw resolved;
      }
      return resolved;
    } finally {
      this.active -= 1;
    }
  }
}

class FakeShutterSound {
  plays = 0;

  play() {
    this.plays += 1;
  }
}

class FakeGallery {
  loadCalls = 0;
  placeholders = [];
  completed = [];
  itemsById = new Map();
  retryListener = null;

  async load() {
    this.loadCalls += 1;
  }

  onRetry(listener) {
    this.retryListener = listener;
  }

  addPlaceholder(placeholder) {
    this.placeholders.unshift({ ...placeholder });
    this.itemsById.set(placeholder.id, { kind: "placeholder", placeholder: { ...placeholder } });
  }

  updatePlaceholder(id, patch) {
    const placeholder = this.placeholders.find((candidate) => candidate.id === id);
    if (!placeholder) {
      return;
    }
    Object.assign(placeholder, patch);
    this.itemsById.set(id, { kind: "placeholder", placeholder: { ...placeholder } });
  }

  async completePlaceholder(frame) {
    const placeholderIndex = this.placeholders.findIndex((candidate) => candidate.id === frame.id);
    if (placeholderIndex !== -1) {
      this.placeholders.splice(placeholderIndex, 1);
    }
    this.completed.push(frame);
    this.itemsById.set(frame.id, { kind: "frame", frame });
  }

  failPlaceholder(id, error) {
    this.updatePlaceholder(id, { status: "error", error });
  }

  frameOrder() {
    return [...this.itemsById.keys()];
  }

  visibleTextFor(id) {
    const item = this.itemsById.get(id);
    if (!item) {
      return "";
    }
    if (item.kind === "frame") {
      return item.frame.imageDataUrl;
    }
    if (item.placeholder.status === "error") {
      return `EXPOSURE FAILED\nERROR ${errorNumberFor(item.placeholder.error)}\nTAP TO RETRY`;
    }
    return "ANALYZING";
  }
}

function contextFixture(mode, cameraPose, manualSettings) {
  const capturedAt = new Date(cameraPose.capturedAt).toISOString();
  return {
    capturedAt,
    mode,
    time: {
      iso: capturedAt,
      date: "Jul 17, 2026",
      time: "10:03",
      timezone: "Asia/Jakarta",
      hour: 10,
      dayPeriod: "morning"
    },
    location: {
      status: "granted",
      latitude: -6.372184,
      longitude: 106.832614,
      accuracy: 8.4,
      label: "Depok, Indonesia"
    },
    weather: {
      status: "granted",
      temperatureC: 29,
      humidityPercent: 70,
      cloudCoverPercent: 10,
      rainMm: 0,
      windKph: 5,
      description: "Clear"
    },
    cameraPose,
    manualSettings,
    orientation: {
      status: "granted",
      aim: "Near horizon"
    },
    motion: {
      status: "granted",
      movement: "Handheld"
    },
    audio: {
      status: "granted",
      descriptor: "Quiet"
    },
    battery: {
      status: "granted",
      levelPercent: 84
    },
    device: {
      language: "en-US",
      languages: ["en-US"],
      deviceType: "phone",
      viewport: {
        width: 390,
        height: 844,
        pixelRatio: 3,
        orientation: "portrait"
      },
      screen: {},
      screenBrightness: "unavailable",
      userAgent: "test"
    }
  };
}

function objectAnalysisFixture() {
  return {
    objects: [
      {
        id: "object-1",
        label: "small gray hedgehog stuffed animal",
        normalizedLabel: "hedgehog plushie",
        category: "toy",
        boundingBox: { x: 0.42, y: 0.12, width: 0.16, height: 0.14 },
        confidence: 0.94,
        salience: 0.95,
        attributes: ["stuffed animal"]
      },
      {
        id: "object-2",
        label: "red sedan",
        normalizedLabel: "car",
        category: "vehicle",
        boundingBox: { x: 0.1, y: 0.35, width: 0.82, height: 0.38 },
        confidence: 0.96,
        salience: 0.9,
        attributes: []
      }
    ],
    relationships: [
      {
        subjectObjectId: "object-1",
        predicate: "on-top-of",
        objectObjectId: "object-2",
        confidence: 0.91
      }
    ],
    provider: "local-cnn:test",
    warnings: [],
    metrics: {
      detectorInferenceMs: 11,
      classifierInferenceMs: 2,
      relationshipInferenceMs: 1,
      totalObjectAnalysisMs: 14,
      backend: "mock",
      detectedCount: 2,
      preservedCount: 2,
      detector: "mock-detector",
      classifier: "mock-classifier",
      modelStatus: "ready"
    }
  };
}

function renderedFrame(label) {
  return {
    imageDataUrl: `data:image/png;base64,overlay-${label}`,
    sceneSummary: `overlay ${label}`,
    renderVersion: "semantic-overlay-v1",
    overlayRenderMs: 7,
    renderedObjects: objectAnalysisFixture().objects,
    renderedRelationships: objectAnalysisFixture().relationships
  };
}

function sourcePhoto(id) {
  return {
    id,
    blob: new Blob(["source"], { type: "image/jpeg" }),
    dataUrl: `data:image/jpeg;base64,${id}`,
    width: 1200,
    height: 900,
    capturedAt: "2026-07-17T03:03:00.000Z",
    estimatedBytes: 1024
  };
}

async function resolveMaybe(value) {
  return value && typeof value.then === "function" ? await value : value;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, timeoutMs = 800) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      assert.fail("Timed out waiting for capture condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}

function errorNumberFor(message) {
  const match = String(message ?? "").match(/\b(\d{3})\b/);
  return match?.[1] ?? "000";
}
