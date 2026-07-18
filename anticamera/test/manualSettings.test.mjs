import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  DEFAULT_MANUAL_SETTINGS,
  evLabel,
  focalDistanceLabel,
  freezeManualSettings,
  loadManualSettings,
  nextFocalDistance,
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
    iso: 200,
    focalDistance: "21mm"
  });
  assert.equal(settingsReadout(DEFAULT_MANUAL_SETTINGS), "LAND DF F21 0EV FL-OFF ISO200");
});

test("hard-detent snapping", () => {
  assert.equal(snapExposure(-2.7), -3);
  assert.equal(snapExposure(0.2), 0);
  assert.equal(snapExposure(2.8), 3);
  assert.equal(snapIso(78), 80);
  assert.equal(snapIso(410), 400);
  assert.equal(snapIso(990), 1000);
  assert.equal(nextFocalDistance("21mm", 1), "28mm");
  assert.equal(nextFocalDistance("telephoto", 1), "macro");
  assert.equal(nextFocalDistance("macro", 1), "macro");
  assert.equal(nextFocalDistance("28mm", -1), "21mm");
});

test("manual settings persistence", () => {
  const storage = fakeStorage();
  const settings = {
    focusStyle: "bokeh",
    exposureCompensationEv: 1,
    subjectMode: "single-person",
    flashMode: "on",
    iso: 400,
    focalDistance: "50mm"
  };
  saveManualSettings(settings, storage);
  assert.deepEqual(loadManualSettings(storage), settings);

  storage.setItem("anticamera.manualSettings.v1", JSON.stringify({
    focusStyle: "bokeh",
    exposureCompensationEv: 1,
    subjectMode: "single-person",
    flashMode: "on",
    iso: 400
  }));
  assert.equal(loadManualSettings(storage).focalDistance, "21mm");
});

test("changing each control value is represented in frozen settings", () => {
  const settings = freezeManualSettings({
    focusStyle: "bokeh",
    exposureCompensationEv: -2,
    subjectMode: "crowd",
    flashMode: "on",
    iso: 1000,
    focalDistance: "telephoto"
  });
  assert.deepEqual(settings, {
    focusStyle: "bokeh",
    exposureCompensationEv: -2,
    subjectMode: "crowd",
    flashMode: "on",
    iso: 1000,
    focalDistance: "telephoto"
  });
});

test("frozen settings at shutter time are immutable copies", () => {
  const live = {
    focusStyle: "bokeh",
    exposureCompensationEv: 3,
    subjectMode: "group",
    flashMode: "on",
    iso: 800,
    focalDistance: "80mm"
  };
  const frozen = freezeManualSettings(live);
  live.iso = 80;
  live.flashMode = "off";
  live.focalDistance = "macro";
  assert.equal(frozen.iso, 800);
  assert.equal(frozen.flashMode, "on");
  assert.equal(frozen.focalDistance, "80mm");
});

test("JSON export includes exact manual settings", async () => {
  const context = contextForPrompt({
    focusStyle: "bokeh",
    exposureCompensationEv: 2,
    subjectMode: "single-person",
    flashMode: "on",
    iso: 640,
    focalDistance: "macro"
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
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: -3 })), /underexposed version of the same scene/);
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: 0 })), /Apply 0 EV/);
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: 3 })), /Apply \+3 EV/);
  assert.match(promptBuilder.build(contextForPrompt({ exposureCompensationEv: 3 })), /substantially overexposed/);
});

test("clear morning daylight at EV -3 cannot become dusk or night", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    exposureCompensationEv: -3,
    time: {
      time: "10:03",
      hour: 10,
      dayPeriod: "morning"
    },
    weather: {
      description: "Clear",
      cloudCoverPercent: 10
    }
  }));

  assert.match(prompt, /PRIORITY 1 -- IMMUTABLE SCENE FACTS/);
  assert.match(prompt, /PRIORITY 4 -- CAMERA RENDERING SETTINGS/);
  assert.match(prompt, /morning daylight/);
  assert.match(prompt, /underexposed version of the same scene/);
  assert.match(prompt, /Do not convert daylight into dusk/);
  assert.match(prompt, /Do not change the sky into a sunset sky/);
  assert.match(prompt, /Known scene: morning daylight, clear weather/);
  assert.match(prompt, /Required result: a severely underexposed morning daylight photograph/);
  assert.match(prompt, /Forbidden result: dusk, sunset, twilight, evening, or nighttime/);
});

test("cloudy midday daylight at EV -3 remains daylight", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    exposureCompensationEv: -3,
    time: {
      time: "12:15",
      hour: 12,
      dayPeriod: "afternoon"
    },
    weather: {
      description: "Cloudy",
      cloudCoverPercent: 88
    }
  }));

  assert.match(prompt, /midday daylight/);
  assert.match(prompt, /Preserve a daytime sky and daylight environmental cues/);
  assert.match(prompt, /Do not convert daylight into dusk/);
  assert.match(prompt, /Do not change the weather/);
});

test("afternoon rain at EV +3 preserves weather and time", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    exposureCompensationEv: 3,
    time: {
      time: "15:30",
      hour: 15,
      dayPeriod: "afternoon"
    },
    weather: {
      description: "Rain",
      rainMm: 3.5,
      cloudCoverPercent: 95
    }
  }));

  assert.match(prompt, /afternoon daylight/);
  assert.match(prompt, /Rain: 3\.5 mm/);
  assert.match(prompt, /Exposure compensation increases recorded exposure only/);
  assert.match(prompt, /Do not change cloudy weather into sunshine/);
  assert.match(prompt, /Do not change the weather/);
});

test("actual dusk at neutral EV is preserved as dusk context", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    exposureCompensationEv: 0,
    time: {
      time: "17:45",
      hour: 17,
      dayPeriod: "evening"
    },
    weather: {
      description: "Partly cloudy"
    }
  }));

  assert.match(prompt, /sunset \/ twilight/);
  assert.match(prompt, /This twilight or dawn illumination is an immutable scene fact/);
  assert.match(prompt, /Apply 0 EV/);
});

test("actual night at EV +3 cannot become daylight", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    exposureCompensationEv: 3,
    time: {
      time: "22:10",
      hour: 22,
      dayPeriod: "night"
    },
    weather: {
      description: "Clear"
    }
  }));

  assert.match(prompt, /night/);
  assert.match(prompt, /Do not create daylight merely because exposure compensation is positive/);
  assert.match(prompt, /must not create daylight/);
  assert.match(prompt, /Forbidden result: daylight or daytime/);
});

test("indoor morning EV -3 preserves morning scene facts", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    mode: "indoor",
    exposureCompensationEv: -3,
    time: {
      time: "09:20",
      hour: 9,
      dayPeriod: "morning"
    },
    weather: {
      description: "Clear"
    }
  }));

  assert.match(prompt, /This is an indoor morning-daylight scene/);
  assert.match(prompt, /underexposed version of the same scene/);
  assert.match(prompt, /Do not convert daylight into dusk/);
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

test("focal distance prompt branches contain concrete optical constraints", () => {
  const promptBuilder = new PromptBuilder();
  assert.equal(focalDistanceLabel("telephoto"), "TELEPHOTO");

  const wide = promptBuilder.build(contextForPrompt({ focalDistance: "21mm" }));
  assert.match(wide, /FOCAL DISTANCE \/ VIRTUAL LENS -- STRICT OPTICAL CONSTRAINT/);
  assert.match(wide, /Selected focal distance: 21 mm full-frame equivalent/);
  assert.match(wide, /broad field of view/);

  const normal = promptBuilder.build(contextForPrompt({ focalDistance: "50mm" }));
  assert.match(normal, /Simulate a 50 mm full-frame-equivalent rectilinear lens/);
  assert.match(normal, /normal-lens perspective/);

  const telephoto = promptBuilder.build(contextForPrompt({ focalDistance: "telephoto" }));
  assert.match(telephoto, /approximately 135 mm full-frame equivalent/);
  assert.match(telephoto, /compressed distance/);

  const macro = promptBuilder.build(contextForPrompt({ focalDistance: "macro" }));
  assert.match(macro, /macro close-focus lens mode/);
  assert.match(macro, /nearby textures, small objects, surfaces, or details/);
  assert.doesNotMatch(macro, /focalDistance: true/);
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
  assert.match(html, /aria-label="Subject mode: LANDSCAPE\. Press to change mode\."/);
  assert.match(html, /data-control="subject-cycle"/);
  assert.match(html, /aria-label="Depth: bokeh"/);
  assert.match(html, /aria-label="Flash on"/);
  assert.match(html, /aria-label="Focal distance selector"/);
  assert.match(html, /data-focal-distance="telephoto"/);
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
      description: "Cloudy",
      ...(overrides.weather || {})
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
  const keys = ["focusStyle", "exposureCompensationEv", "subjectMode", "flashMode", "iso", "focalDistance"];
  return Object.fromEntries(keys.filter((key) => key in overrides).map((key) => [key, overrides[key]]));
}
