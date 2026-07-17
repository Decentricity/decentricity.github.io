import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { DEFAULT_MANUAL_SETTINGS } from "../assets/context/manualSettings.js";

test("capture flow reveals generated image before gallery storage and allows a second exposure", async () => {
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
  await harness.waitForCaptureCount(1);

  assert.equal(harness.imageGenerator.calls.length, 1);
  assert.equal(harness.promptBuilder.calls.length, 1);
  assert.deepEqual(harness.imageGenerator.calls[0].context.manualSettings, settings);
  assert.deepEqual(harness.gallery.addCalls[0].context.manualSettings, settings);
  assert.equal(harness.latestFrame.src, "data:image/png;base64,first");
  assert.equal(harness.viewfinder.querySelector("#latest-frame"), null);
  assert.equal(harness.gallery.addCalls.length, 1);
  assert.equal(harness.shutter.disabled, false);
  assert.ok(harness.developingLayer.classList.contains("hidden"));
  assert.ok(harness.instantReveal.classList.contains("hidden"));

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

test("developing state uses a small indicator and not the optical viewfinder", async () => {
  const pending = deferred();
  const harness = await createAppHarness({
    generatorResults: [pending.promise]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.developingLayer.textContent.includes("DEVELOPING"));
  assert.equal(harness.viewfinder.querySelector("#developing"), null);
  assert.equal(harness.viewfinder.querySelector("#latest-frame"), null);
  assert.equal(harness.viewfinder.classList.contains("is-developing"), true);

  pending.resolve({
    imageDataUrl: "data:image/png;base64,slow",
    provider: "mock-image-provider"
  });
  await harness.waitForCaptureCount(1);
  assert.equal(harness.latestFrame.src, "data:image/png;base64,slow");
  assert.equal(harness.shutter.disabled, false);
});

test("provider failure exits developing state and retry can succeed", async () => {
  const harness = await createAppHarness({
    generatorResults: [new Error("provider exploded"), "data:image/png;base64,retry"]
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.developingLayer.textContent.includes("EXPOSURE FAILED"));
  assert.equal(harness.shutter.disabled, false);

  harness.clickShutter();
  await harness.waitForCaptureCount(2);
  assert.equal(harness.latestFrame.src, "data:image/png;base64,retry");
  assert.equal(harness.shutter.disabled, false);
  assert.ok(harness.developingLayer.classList.contains("hidden"));
});

test("provider timeout exits developing state and leaves shutter usable", async () => {
  const harness = await createAppHarness({
    generatorResults: [new Promise(() => undefined)],
    generationTimeoutMs: 1
  });
  await harness.app.start();

  harness.clickShutter();
  await harness.waitFor(() => harness.developingLayer.textContent.includes("NETWORK TIMEOUT"));

  assert.equal(harness.shutter.disabled, false);
  assert.match(harness.developingLayer.textContent, /PRESS SHUTTER TO RETRY/);
});

test("capture layout survives representative viewport widths", async () => {
  for (const width of [360, 390, 504, 768]) {
    const harness = await createAppHarness({ viewportWidth: width });
    await harness.app.start();
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
  window.innerHeight = 844;
  window.devicePixelRatio = 3;
  window.setInterval = () => 0;

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
    app: null,
    clickShutter() {
      shutter.dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    clickViewfinder() {
      viewfinder.dispatchEvent(new window.Event("click", { bubbles: true }));
    },
    key(keyValue) {
      const event = new window.Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "key", { value: keyValue });
      document.dispatchEvent(event);
    },
    async waitForCaptureCount(count) {
      await waitFor(() => this.imageGenerator.calls.length >= count && !this.shutter.disabled);
    },
    waitFor
  };

  harness.context = new FakeContext(() => harness.manualSettings);
  harness.promptBuilder = new FakePromptBuilder();
  harness.imageGenerator = new FakeImageGenerator(options.generatorResults);
  harness.gallery = new FakeGallery();

  harness.app = new AntiCameraApp(
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
      shutterSound: { play: () => undefined },
      delay: async () => undefined,
      minimumDevelopingTime: () => 0,
      permissionTimeoutMs: 5,
      contextTimeoutMs: 50,
      generationTimeoutMs: options.generationTimeoutMs ?? 50,
      imageLoadTimeoutMs: 5
    }
  );

  return harness;
}

class FakeContext {
  startPassiveCalls = 0;
  primeCalls = 0;
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
    return {
      azimuthDeg: 237,
      pitchDeg: 38.4,
      rollDeg: -7.2,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt: 2_000
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
    const result = this.results.shift() ?? "data:image/png;base64,next";
    if (result instanceof Error) {
      throw result;
    }

    if (result && typeof result.then === "function") {
      return await result;
    }

    return {
      imageDataUrl: result,
      provider: "mock-image-provider"
    };
  }
}

class FakeGallery {
  loadCalls = 0;
  addCalls = [];
  failNextAdd = false;

  async load() {
    this.loadCalls += 1;
  }

  async add(frame) {
    this.addCalls.push(frame);
    if (this.failNextAdd) {
      this.failNextAdd = false;
      throw new Error("QuotaExceededError");
    }
  }
}

function contextForPrompt({ mode = "outdoor", cameraPose, manualSettings }) {
  return {
    capturedAt: "2026-07-17T00:00:02.000Z",
    mode,
    time: {
      iso: "2026-07-17T00:00:02.000Z",
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
        orientation: "portrait"
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

async function waitFor(predicate, timeoutMs = 120) {
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
