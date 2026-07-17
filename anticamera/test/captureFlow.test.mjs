import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { DEFAULT_MANUAL_SETTINGS } from "../assets/context/manualSettings.js";

test("capture flow replaces a placeholder before gallery storage and allows repeat exposures", async () => {
  const harness = await createAppHarness();
  const settings = {
    ...DEFAULT_MANUAL_SETTINGS,
    exposureCompensationEv: 1,
    iso: 160
  };
  harness.manualSettings = settings;
  harness.gallery.failNextAdd = true;

  await harness.app.start();
  assert.equal(harness.gallery.loadCalls, 1);
  assert.equal(harness.context.startPassiveCalls, 1);
  assert.equal(harness.context.snapshots.length, 1);

  harness.clickShutter();
  assert.equal(harness.gallery.placeholders.length, 1);
  assert.equal(harness.gallery.visibleTextFor(harness.gallery.placeholders[0].id), "DEVELOPING");
  await harness.waitForCaptureCount(1);

  assert.equal(harness.imageGenerator.calls.length, 1);
  assert.equal(harness.promptBuilder.calls.length, 1);
  assert.deepEqual(harness.imageGenerator.calls[0].context.manualSettings, settings);
  assert.deepEqual(harness.gallery.addCalls[0].context.manualSettings, settings);
  assert.equal(harness.gallery.itemsById.get(harness.gallery.addCalls[0].id).kind, "frame");
  assert.equal(harness.latestFrame.src, "data:image/png;base64,first");
  assert.equal(harness.viewfinder.querySelector("#latest-frame"), null);
  assert.equal(harness.gallery.addCalls.length, 1);
  assert.equal(harness.shutter.disabled, false);
  assert.equal(harness.appShell.dataset.view, "camera");
  assert.equal(harness.filmView.getAttribute("aria-hidden"), "true");

  harness.manualSettings = {
    ...DEFAULT_MANUAL_SETTINGS,
    exposureCompensationEv: 2,
    iso: 200
  };
  harness.clickShutter();
  await harness.waitForCaptureCount(2);

  assert.equal(harness.latestFrame.src, "data:image/png;base64,second");
  assert.equal(harness.gallery.addCalls.length, 2);
  assert.equal(harness.shutter.disabled, false);
});

test("default view is Camera and the bottom switch opens and closes Film", async () => {
  const harness = await createAppHarness();
  await harness.app.start();

  assert.equal(harness.appShell.dataset.view, "camera");
  assert.equal(harness.cameraView.getAttribute("aria-hidden"), "false");
  assert.equal(harness.filmView.getAttribute("aria-hidden"), "true");
  assert.equal(harness.viewToggle.getAttribute("aria-label"), "Open film roll");
  assert.equal(harness.viewToggle.getAttribute("aria-pressed"), "false");

  harness.clickViewfinder();
  assert.equal(harness.debugPanel.hidden, false);
  harness.clickViewToggle();
  assert.equal(harness.appShell.dataset.view, "film");
  assert.equal(harness.cameraView.getAttribute("aria-hidden"), "true");
  assert.equal(harness.filmView.getAttribute("aria-hidden"), "false");
  assert.equal(harness.debugPanel.hidden, true);
  assert.equal(harness.viewToggle.getAttribute("aria-label"), "Return to camera");
  assert.equal(harness.viewToggle.getAttribute("aria-pressed"), "true");
  assert.equal(harness.viewToggle.classList.contains("is-film-view"), true);

  harness.clickViewToggle();
  assert.equal(harness.appShell.dataset.view, "camera");
  assert.equal(harness.cameraView.getAttribute("aria-hidden"), "false");
  assert.equal(harness.filmView.getAttribute("aria-hidden"), "true");
});

test("debug panel is hidden by default and toggled from the optical viewfinder", async () => {
  const harness = await createAppHarness();
  await harness.app.start();

  assert.equal(harness.debugPanel.hidden, true);
  assert.equal(harness.debugPanel.classList.contains("hidden"), true);
  assert.equal(harness.viewfinder.getAttribute("aria-expanded"), "false");
  assert.match(harness.readout.textContent, /Location:/);

  harness.clickViewfinder();
  assert.equal(harness.debugPanel.hidden, false);
  assert.equal(harness.debugPanel.classList.contains("hidden"), false);
  assert.equal(harness.viewfinder.getAttribute("aria-expanded"), "true");

  harness.clickViewfinder();
  assert.equal(harness.debugPanel.hidden, true);
  assert.equal(harness.viewfinder.getAttribute("aria-expanded"), "false");

  harness.clickViewfinder();
  harness.key("Escape");
  assert.equal(harness.debugPanel.hidden, true);
  assert.equal(harness.viewfinder.getAttribute("aria-expanded"), "false");
});

test("capture works while debug panel is open", async () => {
  const harness = await createAppHarness();
  await harness.app.start();

  harness.clickViewfinder();
  assert.equal(harness.debugPanel.hidden, false);
  harness.clickShutter();
  await harness.waitForCaptureCount(1);

  assert.equal(harness.latestFrame.src, "data:image/png;base64,first");
  assert.equal(harness.gallery.addCalls.length, 1);
  assert.equal(harness.shutter.disabled, false);
});

test("queue continues while Film view is active and updates the hidden film roll", async () => {
  const pending = deferred();
  const harness = await createAppHarness({
    generatorResults: [pending.promise]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.imageGenerator.calls.length === 1);
  const id = harness.gallery.placeholders[0].id;
  harness.clickViewToggle();
  assert.equal(harness.appShell.dataset.view, "film");
  assert.equal(harness.gallery.visibleTextFor(id), "DEVELOPING");

  pending.resolve({
    imageDataUrl: "data:image/png;base64,film",
    provider: "mock-image-provider"
  });
  await harness.waitForCaptureCount(1);

  assert.equal(harness.appShell.dataset.view, "film");
  assert.equal(harness.gallery.itemsById.get(id).kind, "frame");
  assert.equal(harness.latestFrame.src, "data:image/png;base64,film");
  harness.clickViewToggle();
  assert.equal(harness.appShell.dataset.view, "camera");
});

test("developing state lives in the film frame, not the optical viewfinder", async () => {
  const pending = deferred();
  const harness = await createAppHarness({
    generatorResults: [pending.promise]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.imageGenerator.calls.length === 1);
  const id = harness.gallery.placeholders[0].id;

  assert.match(harness.developingLayer.textContent, /1 DEVELOPING/);
  assert.equal(harness.gallery.visibleTextFor(id), "DEVELOPING");
  assert.equal(harness.viewfinder.querySelector("#developing"), null);
  assert.equal(harness.viewfinder.querySelector("#latest-frame"), null);
  assert.equal(harness.viewfinder.classList.contains("is-developing"), true);

  pending.resolve({
    imageDataUrl: "data:image/png;base64,slow",
    provider: "mock-image-provider"
  });
  await harness.waitForCaptureCount(1);
  await harness.waitFor(() => harness.developingLayer.textContent.includes("READY"));
  assert.equal(harness.latestFrame.src, "data:image/png;base64,slow");
  assert.equal(harness.shutter.disabled, false);
});

test("rapid shutter presses create ordered placeholders and process provider requests sequentially", async () => {
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const harness = await createAppHarness({
    generatorResults: [first.promise, second.promise, third.promise]
  });
  await harness.app.start();

  harness.manualSettings = { ...DEFAULT_MANUAL_SETTINGS, iso: 100, exposureCompensationEv: 0 };
  harness.clickShutter();
  harness.manualSettings = { ...DEFAULT_MANUAL_SETTINGS, iso: 800, exposureCompensationEv: -2 };
  harness.clickShutter();
  harness.manualSettings = { ...DEFAULT_MANUAL_SETTINGS, iso: 200, exposureCompensationEv: 1 };
  harness.clickShutter();

  assert.equal(harness.gallery.placeholders.length, 3);
  assert.equal(harness.shutterSound.plays, 3);
  assert.deepEqual(
    harness.gallery.placeholders.map((placeholder) => harness.gallery.visibleTextFor(placeholder.id)),
    ["DEVELOPING", "DEVELOPING", "DEVELOPING"]
  );
  const originalOrder = harness.gallery.frameOrder();

  await harness.waitFor(() => harness.imageGenerator.calls.length === 1);
  assert.equal(harness.imageGenerator.activeCount, 1);
  assert.equal(harness.imageGenerator.maxActive, 1);
  assert.equal(harness.shutter.disabled, false);

  first.resolve({
    imageDataUrl: "data:image/png;base64,one",
    provider: "mock-image-provider"
  });
  await harness.waitFor(() => harness.gallery.addCalls.length === 1 && harness.imageGenerator.calls.length === 2);
  assert.deepEqual(harness.gallery.frameOrder(), originalOrder);
  assert.equal(harness.gallery.itemsById.get(originalOrder[2]).kind, "frame");
  assert.equal(harness.gallery.itemsById.get(originalOrder[1]).kind, "placeholder");

  second.resolve({
    imageDataUrl: "data:image/png;base64,two",
    provider: "mock-image-provider"
  });
  await harness.waitFor(() => harness.gallery.addCalls.length === 2 && harness.imageGenerator.calls.length === 3);
  assert.deepEqual(harness.gallery.frameOrder(), originalOrder);

  third.resolve({
    imageDataUrl: "data:image/png;base64,three",
    provider: "mock-image-provider"
  });
  await harness.waitForCaptureCount(3);

  assert.deepEqual(harness.gallery.frameOrder(), originalOrder);
  assert.equal(harness.imageGenerator.maxActive, 1);
  assert.deepEqual(
    harness.promptBuilder.calls.map((context) => ({
      iso: context.manualSettings.iso,
      ev: context.manualSettings.exposureCompensationEv
    })),
    [
      { iso: 100, ev: 0 },
      { iso: 800, ev: -2 },
      { iso: 200, ev: 1 }
    ]
  );
});

test("queue continues after a provider failure in the middle", async () => {
  const harness = await createAppHarness({
    generatorResults: [
      "data:image/png;base64,one",
      new Error("provider exploded"),
      "data:image/png;base64,three"
    ]
  });
  await harness.app.start();

  harness.clickShutter();
  harness.clickShutter();
  harness.clickShutter();

  await harness.waitFor(() => harness.imageGenerator.calls.length === 3 && harness.gallery.addCalls.length === 2);
  assert.equal(harness.gallery.errorItems().length, 1);
  assert.match(harness.gallery.errorItems()[0].placeholder.error, /provider exploded/);
  assert.equal(harness.shutter.disabled, false);
  assert.match(harness.developingLayer.textContent, /READY/);
});

test("failed placeholders can retry with the same frozen job state", async () => {
  const harness = await createAppHarness({
    generatorResults: [new Error("provider exploded"), "data:image/png;base64,retry"]
  });
  await harness.app.start();

  harness.manualSettings = { ...DEFAULT_MANUAL_SETTINGS, iso: 640, exposureCompensationEv: -1 };
  harness.clickShutter();
  await harness.waitFor(() => harness.gallery.errorItems().length === 1);
  const id = harness.gallery.errorItems()[0].placeholder.id;
  assert.equal(harness.shutter.disabled, false);

  harness.gallery.retry(id);
  await harness.waitForCaptureCount(1);

  assert.equal(harness.gallery.itemsById.get(id).kind, "frame");
  assert.equal(harness.latestFrame.src, "data:image/png;base64,retry");
  assert.deepEqual(
    harness.promptBuilder.calls.map((context) => context.manualSettings),
    [
      { ...DEFAULT_MANUAL_SETTINGS, iso: 640, exposureCompensationEv: -1 },
      { ...DEFAULT_MANUAL_SETTINGS, iso: 640, exposureCompensationEv: -1 }
    ]
  );
});

test("provider timeout marks the placeholder failed and leaves shutter usable", async () => {
  const harness = await createAppHarness({
    generatorResults: [new Promise(() => undefined)],
    generationTimeoutMs: 1
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.gallery.errorItems().length === 1);

  assert.equal(harness.shutter.disabled, false);
  assert.match(harness.gallery.errorItems()[0].placeholder.error, /image generation timed out/);
});

test("queue limit disables the shutter only while the film buffer is full", async () => {
  const first = deferred();
  const harness = await createAppHarness({
    generatorResults: [first.promise, "data:image/png;base64,second"],
    maxQueuedCaptures: 2
  });
  await harness.app.start();

  harness.clickShutter();
  harness.clickShutter();
  assert.equal(harness.gallery.placeholders.length, 2);
  assert.equal(harness.shutter.disabled, true);
  assert.match(harness.developingLayer.textContent, /FILM BUFFER FULL/);

  harness.clickShutter();
  assert.equal(harness.gallery.placeholders.length, 2);

  first.resolve({
    imageDataUrl: "data:image/png;base64,one",
    provider: "mock-image-provider"
  });
  await harness.waitFor(() => harness.shutter.disabled === false);
});

test("shutter sound is attempted for every accepted exposure and failure does not block capture", async () => {
  const harness = await createAppHarness();
  harness.shutterSound.throwNext = true;
  await harness.app.start();

  harness.clickShutter();
  await harness.waitForCaptureCount(1);

  assert.equal(harness.shutterSound.plays, 1);
  assert.equal(harness.gallery.addCalls.length, 1);
});

test("capture layout survives representative landscape, portrait, and tablet viewport sizes", async () => {
  for (const [width, height] of [
    [360, 800],
    [390, 844],
    [412, 915],
    [504, 1066],
    [800, 360],
    [844, 390],
    [915, 412],
    [1066, 504],
    [768, 1024],
    [1024, 768]
  ]) {
    const harness = await createAppHarness({ viewportWidth: width, viewportHeight: height });
    await harness.app.start();
    assert.equal(harness.document.querySelector(".app-shell") instanceof harness.window.HTMLElement, true);
    assert.equal(harness.document.querySelector(".camera-view") instanceof harness.window.HTMLElement, true);
    assert.equal(harness.document.querySelector(".film-view") instanceof harness.window.HTMLElement, true);
    assert.equal(harness.document.querySelector(".camera-top-plate > #viewfinder"), harness.viewfinder);
    assert.equal(harness.document.querySelector(".camera-top-plate > #shutter"), harness.shutter);
    assert.equal(harness.document.getElementById("fullscreen-button") instanceof harness.window.HTMLButtonElement, true);
    assert.equal(harness.viewToggle instanceof harness.window.HTMLButtonElement, true);

    harness.clickShutter();
    await harness.waitForCaptureCount(1);
    assert.equal(harness.shutter.disabled, false);
    assert.equal(harness.imageGenerator.calls.length, 1);
  }
});

async function createAppHarness(options = {}) {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const { window, document } = parseHTML(html);
  window.location = { search: "" };
  window.innerWidth = options.viewportWidth ?? 390;
  window.innerHeight = options.viewportHeight ?? 844;
  window.devicePixelRatio = 3;
  window.setInterval = () => 0;

  let uuidCounter = 0;
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => {
        uuidCounter += 1;
        return `test-job-${uuidCounter}`;
      }
    },
    configurable: true
  });
  Object.defineProperty(window.navigator, "vibrate", {
    value: () => true,
    configurable: true
  });
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    configurable: true
  });

  globalThis.window = window;
  globalThis.document = document;
  globalThis.localStorage = fakeStorage();
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement;
  globalThis.HTMLFormElement = window.HTMLFormElement;
  globalThis.HTMLInputElement = window.HTMLInputElement;
  globalThis.HTMLImageElement = window.HTMLImageElement;
  globalThis.HTMLOListElement = window.HTMLOListElement;

  const { AntiCameraApp } = await import(`../assets/ui/app.js?cache=${Date.now()}-${Math.random()}`);

  const viewfinder = document.getElementById("viewfinder");
  const appShell = document.getElementById("app-shell");
  const cameraView = document.getElementById("camera-view");
  const filmView = document.getElementById("film-view");
  const viewToggle = document.getElementById("view-toggle");
  const debugPanel = document.getElementById("debug-panel");
  const readout = document.getElementById("context-readout");
  const developingLayer = document.getElementById("developing");
  const instantReveal = document.getElementById("instant-reveal");
  const latestFrame = document.getElementById("latest-frame");
  const keyPanel = document.getElementById("key-panel");
  const keyInput = document.getElementById("openai-key");
  const keyMessage = document.getElementById("key-message");
  const batteryFill = document.getElementById("battery-fill");
  const batteryLabel = document.getElementById("battery-label");
  const shutter = document.getElementById("shutter");
  const modeInputs = document.querySelectorAll("input[name='scene-mode']");

  installInstantImage(latestFrame, window);

  const harness = {
    window,
    document,
    appShell,
    cameraView,
    filmView,
    viewToggle,
    viewfinder,
    debugPanel,
    readout,
    developingLayer,
    instantReveal,
    latestFrame,
    shutter,
    manualSettings: { ...DEFAULT_MANUAL_SETTINGS },
    context: null,
    promptBuilder: null,
    imageGenerator: null,
    gallery: null,
    shutterSound: null,
    app: null,
    clickShutter() {
      shutter.dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    clickViewfinder() {
      viewfinder.dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    clickViewToggle() {
      viewToggle.dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    key(keyValue) {
      const event = new window.Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "key", { value: keyValue });
      document.dispatchEvent(event);
    },
    async waitForCaptureCount(count) {
      await waitFor(() => this.gallery.addCalls.length >= count);
    },
    waitFor
  };

  harness.context = new FakeContext(() => harness.manualSettings);
  harness.promptBuilder = new FakePromptBuilder();
  harness.imageGenerator = new FakeImageGenerator(options.generatorResults);
  harness.gallery = new FakeGallery();
  harness.shutterSound = new FakeShutterSound();

  harness.app = new AntiCameraApp(
    appShell,
    cameraView,
    filmView,
    viewToggle,
    viewfinder,
    debugPanel,
    readout,
    developingLayer,
    instantReveal,
    latestFrame,
    keyPanel,
    keyInput,
    keyMessage,
    batteryFill,
    batteryLabel,
    shutter,
    modeInputs,
    {
      currentSettings: () => ({ ...harness.manualSettings }),
      freezeSettings: () => ({ ...harness.manualSettings }),
      onChange: () => undefined
    },
    harness.gallery,
    {
      context: harness.context,
      promptBuilder: harness.promptBuilder,
      imageGenerator: harness.imageGenerator,
      shutterSound: harness.shutterSound,
      delay: async () => undefined,
      minimumDevelopingTime: () => 0,
      permissionTimeoutMs: 5,
      contextTimeoutMs: 50,
      generationTimeoutMs: options.generationTimeoutMs ?? 50,
      imageLoadTimeoutMs: 5,
      maxQueuedCaptures: options.maxQueuedCaptures
    }
  );

  return harness;
}

class FakeContext {
  startPassiveCalls = 0;
  primeCalls = 0;
  poseCount = 0;
  snapshots = [];

  constructor(settingsProvider) {
    this.settingsProvider = settingsProvider;
  }

  async startPassiveCollection() {
    this.startPassiveCalls += 1;
  }

  async primeFromUserGesture() {
    this.primeCalls += 1;
  }

  freezeCameraPose() {
    const capturedAt = 2_000 + this.poseCount * 1_000;
    this.poseCount += 1;
    return {
      azimuthDeg: 237,
      pitchDeg: 38.4,
      rollDeg: -7.2,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt
    };
  }

  async snapshot(mode, frozenPose, frozenSettings) {
    const settings = frozenSettings ?? this.settingsProvider();
    const context = contextForPrompt({ mode, cameraPose: frozenPose ?? this.freezeCameraPose(), manualSettings: settings });
    this.snapshots.push(context);
    return context;
  }
}

class FakePromptBuilder {
  calls = [];

  build(context) {
    this.calls.push(context);
    return `prompt ev=${context.manualSettings.exposureCompensationEv} iso=${context.manualSettings.iso}`;
  }
}

class FakeImageGenerator {
  calls = [];
  activeCount = 0;
  maxActive = 0;

  constructor(results = ["data:image/png;base64,first", "data:image/png;base64,second"]) {
    this.results = [...results];
  }

  canGenerate() {
    return true;
  }

  providerId() {
    return "mock-image-provider";
  }

  saveUserKey() {}

  async generate(request) {
    this.calls.push(request);
    this.activeCount += 1;
    this.maxActive = Math.max(this.maxActive, this.activeCount);
    try {
      const result = this.results.shift() ?? "data:image/png;base64,next";
      if (result instanceof Error) {
        throw result;
      }

      const resolved = result && typeof result.then === "function" ? await result : result;
      if (resolved instanceof Error) {
        throw resolved;
      }

      if (resolved && typeof resolved === "object" && "imageDataUrl" in resolved) {
        return resolved;
      }

      return {
        imageDataUrl: resolved,
        provider: "mock-image-provider"
      };
    } finally {
      this.activeCount -= 1;
    }
  }
}

class FakeGallery {
  loadCalls = 0;
  addCalls = [];
  failNextAdd = false;
  retryListener = null;
  items = [];
  placeholders = [];
  itemsById = new Map();

  async load() {
    this.loadCalls += 1;
  }

  onRetry(listener) {
    this.retryListener = listener;
  }

  addPlaceholder(placeholder) {
    const copy = { ...placeholder };
    this.placeholders.push(copy);
    this.items.unshift({ kind: "placeholder", placeholder: copy });
    this.reindex();
  }

  updatePlaceholder(id, patch) {
    const item = this.items.find((candidate) => candidate.kind === "placeholder" && candidate.placeholder.id === id);
    if (!item) {
      return;
    }

    Object.assign(item.placeholder, patch);
    this.reindex();
  }

  async completePlaceholder(frame) {
    this.addCalls.push(frame);
    const index = this.items.findIndex((item) => item.kind === "placeholder" && item.placeholder.id === frame.id);
    if (index === -1) {
      this.items.unshift({ kind: "frame", frame });
    } else {
      this.items[index] = { kind: "frame", frame };
    }
    this.reindex();

    if (this.failNextAdd) {
      this.failNextAdd = false;
      throw new Error("QuotaExceededError");
    }
  }

  failPlaceholder(id, error) {
    this.updatePlaceholder(id, {
      status: "error",
      error
    });
  }

  retry(id) {
    this.retryListener?.(id);
  }

  frameOrder() {
    return this.items.map((item) => item.kind === "frame" ? item.frame.id : item.placeholder.id);
  }

  visibleTextFor(id) {
    const item = this.itemsById.get(id);
    if (!item) {
      return "";
    }

    if (item.kind === "frame") {
      return "FRAME";
    }

    return item.placeholder.status === "error" ? "EXPOSURE FAILED\nTAP TO RETRY" : "DEVELOPING";
  }

  errorItems() {
    return this.items.filter((item) => item.kind === "placeholder" && item.placeholder.status === "error");
  }

  async add(frame) {
    this.addCalls.push(frame);
    this.items.unshift({ kind: "frame", frame });
    this.reindex();
    if (this.failNextAdd) {
      this.failNextAdd = false;
      throw new Error("QuotaExceededError");
    }
  }

  reindex() {
    this.itemsById = new Map(this.items.map((item) => [
      item.kind === "frame" ? item.frame.id : item.placeholder.id,
      item
    ]));
  }
}

class FakeShutterSound {
  plays = 0;
  throwNext = false;

  play() {
    this.plays += 1;
    if (this.throwNext) {
      this.throwNext = false;
      throw new Error("sound failed");
    }
  }
}

function contextForPrompt({ mode = "outdoor", cameraPose, manualSettings }) {
  return {
    capturedAt: new Date(cameraPose.capturedAt).toISOString(),
    mode,
    time: {
      iso: new Date(cameraPose.capturedAt).toISOString(),
      date: "Jul 17, 2026",
      time: "07:00",
      timezone: "Asia/Jakarta",
      hour: 7,
      dayPeriod: "morning"
    },
    location: {
      status: "granted",
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 5,
      label: "Jakarta, Indonesia"
    },
    weather: {
      status: "granted",
      temperatureC: 28,
      humidityPercent: 80,
      cloudCoverPercent: 70,
      rainMm: 0,
      windKph: 8,
      description: "Cloudy"
    },
    cameraPose,
    manualSettings,
    orientation: {
      status: "granted",
      alpha: 0,
      beta: 90,
      gamma: 0,
      aim: "Upward"
    },
    motion: {
      status: "granted",
      movement: "Handheld",
      accelerationMagnitude: 0.2,
      rotationRate: 0.1
    },
    audio: {
      status: "granted",
      averageVolume: 0.02,
      noisiness: 0.2,
      speechProbability: 0.1,
      descriptor: "Quiet"
    },
    battery: {
      status: "granted",
      levelPercent: 84,
      charging: false
    },
    device: {
      language: "en-US",
      languages: ["en-US"],
      deviceType: "phone",
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        orientation: window.innerWidth > window.innerHeight ? "landscape" : "portrait"
      },
      screen: {
        width: window.innerWidth,
        height: window.innerHeight,
        colorDepth: 24
      },
      screenBrightness: "unavailable",
      userAgent: "test"
    }
  };
}

function installInstantImage(image, window) {
  let currentSrc = "";
  Object.defineProperties(image, {
    src: {
      get() {
        return currentSrc;
      },
      set(value) {
        currentSrc = value;
        this.complete = true;
        this.naturalWidth = 1024;
        queueMicrotask(() => this.onload?.(new window.Event("load")));
      }
    },
    complete: {
      value: false,
      writable: true
    },
    naturalWidth: {
      value: 0,
      writable: true
    }
  });
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

async function waitFor(predicate, timeoutMs = 500) {
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
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}
