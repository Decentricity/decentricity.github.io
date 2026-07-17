import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  DEFAULT_MANUAL_SETTINGS,
  evLabel,
  freezeManualSettings,
  loadManualSettings,
  saveManualSettings,
  settingsReadout,
  snapExposure,
  snapIso
} from "../assets/context/manualSettings.js";
import { FrameStorage } from "../assets/gallery/storage.js";
import { PromptBuilder } from "../assets/promptBuilder.js";

test("manual settings defaults", () => {
  assert.deepEqual(DEFAULT_MANUAL_SETTINGS, {
    focusStyle: "deep-focus",
    exposureCompensationEv: 0,
    subjectMode: "landscape",
    flashMode: "off",
    iso: 200
  });
  assert.equal(settingsReadout(DEFAULT_MANUAL_SETTINGS), "LAND DF 0EV FL-OFF ISO200");
});

test("hard-detent snapping", () => {
  assert.equal(snapExposure(-2.7), -3);
  assert.equal(snapExposure(0.2), 0);
  assert.equal(snapExposure(2.8), 3);
  assert.equal(snapIso(78), 80);
  assert.equal(snapIso(410), 400);
  assert.equal(snapIso(990), 1000);
});

test("manual settings persistence", () => {
  const storage = fakeStorage();
  const settings = {
    focusStyle: "bokeh",
    exposureCompensationEv: 1,
    subjectMode: "single-person",
    flashMode: "on",
    iso: 400
  };
  saveManualSettings(settings, storage);
  assert.deepEqual(loadManualSettings(storage), settings);
});

test("changing each control value is represented in frozen settings", () => {
  const settings = freezeManualSettings({
    focusStyle: "bokeh",
    exposureCompensationEv: -2,
    subjectMode: "crowd",
    flashMode: "on",
    iso: 1000
  });
  assert.deepEqual(settings, {
    focusStyle: "bokeh",
    exposureCompensationEv: -2,
    subjectMode: "crowd",
    flashMode: "on",
    iso: 1000
  });
});

test("frozen settings at shutter time are immutable copies", () => {
  const live = {
    focusStyle: "bokeh",
    exposureCompensationEv: 3,
    subjectMode: "group",
    flashMode: "on",
    iso: 800
  };
  const frozen = freezeManualSettings(live);
  live.iso = 80;
  live.flashMode = "off";
  assert.equal(frozen.iso, 800);
  assert.equal(frozen.flashMode, "on");
});

test("JSON export includes exact manual settings", async () => {
  const context = contextForPrompt({
    focusStyle: "bokeh",
    exposureCompensationEv: 2,
    subjectMode: "single-person",
    flashMode: "on",
    iso: 640
  });
  const storage = new FrameStorage();
  const blob = storage.exportMetadata([{
    id: "frame-1",
    timestamp: context.capturedAt,
    imageDataUrl: "data:image/jpeg;base64,test",
    provider: "test",
    prompt: "hidden prompt",
    context
  }]);
  const exported = JSON.parse(await blob.text());
  assert.deepEqual(exported[0].context.manualSettings, context.manualSettings);
});

test("prompt output covers every subject mode", () => {
  const promptBuilder = new PromptBuilder();
  const expected = {
    landscape: /SUBJECT PRIORITY: LANDSCAPE \/ ENVIRONMENT/,
    "single-person": /SUBJECT PRIORITY: ONE PERSON/,
    group: /SUBJECT PRIORITY: SMALL GROUP/,
    crowd: /SUBJECT PRIORITY: CROWD/
  };

  for (const [subjectMode, pattern] of Object.entries(expected)) {
    assert.match(promptBuilder.build(contextForPrompt({ subjectMode })), pattern);
  }
});

test("bokeh and deep-focus prompt branches contain concrete optics", () => {
  const promptBuilder = new PromptBuilder();
  assert.match(promptBuilder.build(contextForPrompt({ focusStyle: "bokeh", subjectMode: "single-person" })), /Use shallow depth of field with a clearly defined focal plane/);
  assert.match(promptBuilder.build(contextForPrompt({ focusStyle: "bokeh", subjectMode: "single-person" })), /strong bokeh requires close subject distance/);
  assert.match(promptBuilder.build(contextForPrompt({ focusStyle: "deep-focus" })), /Use broad depth of field/);
  assert.doesNotMatch(promptBuilder.build(contextForPrompt({ focusStyle: "bokeh" })), /bokeh: true/);
});

test("EV prompt branches for -3, 0, and +3 are photographic", () => {
  const promptBuilder = new PromptBuilder();
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: -3 })), /Apply -3 EV/);
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: -3 })), /substantially underexposed/);
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: 0 })), /Apply 0 EV/);
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: 3 })), /Apply \+3 EV/);
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: 3 })), /substantially overexposed/);
});

test("flash on and off prompt branches", () => {
  const promptBuilder = new PromptBuilder();
  assert.match(promptBuilder.build(contextForPrompt({ flashMode: "off" })), /FLASH: OFF/);
  assert.match(promptBuilder.build(contextForPrompt({ flashMode: "off" })), /Use only plausible ambient illumination/);
  assert.match(promptBuilder.build(contextForPrompt({ flashMode: "on" })), /FLASH: ON -- DIRECT COMPACT-CAMERA FLASH/);
  assert.match(promptBuilder.build(contextForPrompt({ flashMode: "on", subjectMode: "crowd" })), /avoid lighting an entire large crowd uniformly/);
});

test("ISO 80, 400, and 1000 prompt branches", () => {
  const promptBuilder = new PromptBuilder();
  assert.match(promptBuilder.build(contextForPrompt({ iso: 80 })), /Simulate slow fine-grained color film/);
  assert.match(promptBuilder.build(contextForPrompt({ iso: 400 })), /general-purpose consumer color film/);
  assert.match(promptBuilder.build(contextForPrompt({ iso: 1000 })), /fast consumer film/);
  assert.match(promptBuilder.build(contextForPrompt({ iso: 1000 })), /coarser but organic film grain/);
});

test("setting interactions are explicit physical reasoning", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    mode: "indoor",
    time: { dayPeriod: "night" },
    iso: 80,
    flashMode: "off",
    exposureCompensationEv: -1
  }));
  assert.match(prompt, /ISO 80-160, flash off, and dim interior\/night context/);
  assert.match(prompt, /Exposure compensation changes brightness, not the scene's hour/);
  assert.match(prompt, /A tiny direct flash cannot illuminate distant mountains/);
});

test("accessibility labels exist for manual controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /aria-label="Manual photographic controls"/);
  assert.match(html, /aria-label="Subject mode: landscape"/);
  assert.match(html, /aria-label="Subject mode: one person"/);
  assert.match(html, /aria-label="Depth: bokeh"/);
  assert.match(html, /aria-label="Flash on"/);
  assert.match(html, /aria-label="Exposure compensation dial"/);
  assert.match(html, /aria-label="ISO dial"/);
});

test("unsupported audio or sensor context does not affect manual prompt controls", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    audio: { status: "unavailable", descriptor: "Unknown" },
    orientation: { status: "unavailable", aim: "Unknown" },
    focusStyle: "bokeh",
    iso: 1000,
    flashMode: "on"
  }));
  assert.match(prompt, /Use shallow depth of field/);
  assert.match(prompt, /FILM SPEED: ISO 1000/);
  assert.match(prompt, /FLASH: ON -- DIRECT COMPACT-CAMERA FLASH/);
});

function fakeStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    }
  };
}

function contextForPrompt(overrides = {}) {
  const manualSettings = {
    ...DEFAULT_MANUAL_SETTINGS,
    ...pickManual(overrides)
  };
  const time = {
    iso: "2026-07-17T00:00:02.000Z",
    date: "Jul 17, 2026",
    time: "07:00",
    timezone: "Asia/Jakarta",
    hour: 7,
    dayPeriod: "morning",
    ...(overrides.time || {})
  };

  return {
    capturedAt: "2026-07-17T00:00:02.000Z",
    mode: overrides.mode || "outdoor",
    time,
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
    cameraPose: {
      azimuthDeg: 237,
      pitchDeg: 3,
      rollDeg: -2,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt: 2_000
    },
    manualSettings,
    orientation: overrides.orientation || {
      status: "granted",
      alpha: 0,
      beta: 90,
      gamma: 0,
      aim: "Near horizon"
    },
    motion: {
      status: "granted",
      movement: "Handheld",
      accelerationMagnitude: 0.2,
      rotationRate: 0.1
    },
    audio: overrides.audio || {
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
        width: 390,
        height: 844,
        pixelRatio: 3,
        orientation: "portrait"
      },
      screen: {
        width: 390,
        height: 844,
        colorDepth: 24
      },
      screenBrightness: "unavailable",
      userAgent: "test"
    }
  };
}

function pickManual(overrides) {
  const keys = ["focusStyle", "exposureCompensationEv", "subjectMode", "flashMode", "iso"];
  return Object.fromEntries(keys.filter((key) => key in overrides).map((key) => [key, overrides[key]]));
}
