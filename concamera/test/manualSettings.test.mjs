import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_MANUAL_SETTINGS,
  freezeManualSettings,
  loadManualSettings,
  nextAnalysisMode,
  nextConfidenceThreshold,
  nextDomain,
  nextOverlayDensity,
  nextScanMode,
  nextViewMode,
  saveManualSettings,
  scanModeObjectLimit,
  settingsReadout,
  snapConfidenceThreshold
} from "../assets/context/manualSettings.js";
import { FrameStorage } from "../assets/gallery/storage.js";

test("ConCamera settings defaults are local semantic-overlay controls", () => {
  assert.deepEqual(DEFAULT_MANUAL_SETTINGS, {
    domain: "general",
    overlayDensity: "normal",
    analysisMode: "taxonomy",
    relationsVisible: true,
    boxesVisible: true,
    confidenceThreshold: 0.5,
    scanMode: "balanced",
    viewMode: "live"
  });
  assert.equal(
    settingsReadout(DEFAULT_MANUAL_SETTINGS),
    "LENS-GENERAL OVR-NORM MODE-TAXONOMY REL-ON BOX-ON C50 SCAN-BALANCED VIEW-LIVE"
  );
});

test("semantic control detents snap and cycle predictably", () => {
  assert.equal(nextDomain("general", 1), "urban");
  assert.equal(nextDomain("food", 1), "general");
  assert.equal(nextDomain("general", -1), "food");
  assert.equal(nextOverlayDensity("minimal", 1), "normal");
  assert.equal(nextOverlayDensity("full", 1), "full");
  assert.equal(nextAnalysisMode("taxonomy", 1), "semantic");
  assert.equal(nextAnalysisMode("attention", 1), "taxonomy");
  assert.equal(snapConfidenceThreshold(0.36), 0.4);
  assert.equal(snapConfidenceThreshold(0.94), 0.9);
  assert.equal(nextConfidenceThreshold(0.5, 1), 0.6);
  assert.equal(nextConfidenceThreshold(0.3, -1), 0.3);
  assert.equal(nextScanMode("focus", 1), "balanced");
  assert.equal(nextScanMode("survey", 1), "survey");
  assert.equal(nextViewMode("live", 1), "freeze");
  assert.equal(nextViewMode("freeze", -1), "live");
});

test("scan mode object limits match the user-facing control", () => {
  assert.equal(scanModeObjectLimit("focus"), 4);
  assert.equal(scanModeObjectLimit("balanced"), 8);
  assert.equal(scanModeObjectLimit("survey"), 16);
});

test("ConCamera settings persist under independent storage key with safe legacy fallback", () => {
  const storage = fakeStorage();
  const settings = {
    domain: "tech",
    overlayDensity: "full",
    analysisMode: "semantic",
    relationsVisible: false,
    boxesVisible: false,
    confidenceThreshold: 0.8,
    scanMode: "survey",
    viewMode: "freeze"
  };

  saveManualSettings(settings, storage);
  assert.equal(storage.getItem("concamera.manualSettings.v1"), null);
  assert.deepEqual(loadManualSettings(storage), settings);

  const legacyStorage = fakeStorage();
  legacyStorage.setItem("concamera.manualSettings.v1", JSON.stringify({
    domain: "food",
    overlayDensity: "minimal",
    analysisMode: "risk",
    relationsVisible: false,
    boxesVisible: true,
    confidenceThreshold: 0.7,
    scanMode: "focus",
    viewMode: "freeze"
  }));
  assert.equal(loadManualSettings(legacyStorage).domain, "food");

  legacyStorage.setItem("concamera.overlaySettings.v1", "{not-json");
  assert.deepEqual(loadManualSettings(legacyStorage), DEFAULT_MANUAL_SETTINGS);
});

test("invalid or stale saved settings degrade to defaults", () => {
  const storage = fakeStorage();
  storage.setItem("concamera.overlaySettings.v1", JSON.stringify({
    domain: "portrait",
    overlayDensity: "diagnostic",
    analysisMode: "generate",
    relationsVisible: "yes",
    boxesVisible: 1,
    confidenceThreshold: 0.95,
    scanMode: "everything",
    viewMode: "record"
  }));
  assert.deepEqual(loadManualSettings(storage), DEFAULT_MANUAL_SETTINGS);
});

test("frozen ConCamera settings are immutable copies", () => {
  const live = {
    ...DEFAULT_MANUAL_SETTINGS,
    domain: "urban",
    overlayDensity: "full",
    analysisMode: "attention",
    relationsVisible: false,
    boxesVisible: false,
    confidenceThreshold: 0.9,
    scanMode: "survey",
    viewMode: "freeze"
  };
  const frozen = freezeManualSettings(live);
  live.domain = "nature";
  live.confidenceThreshold = 0.3;
  live.relationsVisible = true;

  assert.equal(frozen.domain, "urban");
  assert.equal(frozen.confidenceThreshold, 0.9);
  assert.equal(frozen.relationsVisible, false);
});

test("JSON export includes overlay settings and semantic metadata", async () => {
  const storage = new FrameStorage();
  const context = contextFixture({
    conCamera: {
      detectedFaceCount: 0,
      faceAnalysisProvider: "local-face-detector",
      overlaySettings: {
        ...DEFAULT_MANUAL_SETTINGS,
        domain: "vehicle",
        analysisMode: "semantic",
        confidenceThreshold: 0.7
      },
      recognizedObjects: [
        { label: "hedgehog plushie", normalizedLabel: "hedgehog plushie", category: "toy" },
        { label: "car", normalizedLabel: "car", category: "vehicle" }
      ],
      objectRelationships: [
        { subject: "hedgehog plushie", predicate: "on-top-of", object: "car" }
      ],
      objectAnalysisProvider: "local-cnn:coco-ssd+mobilenet",
      objectAnalysisMetrics: {
        detectorInferenceMs: 20,
        classifierInferenceMs: 3,
        relationshipInferenceMs: 1,
        overlayRenderMs: 8,
        totalObjectAnalysisMs: 24,
        backend: "webgl",
        detectedCount: 2,
        preservedCount: 2,
        detector: "COCO-SSD",
        classifier: "MobileNet",
        modelStatus: "ready"
      },
      sceneSummary: "hedgehog plushie, car; hedgehog plushie on top of car",
      renderVersion: "semantic-overlay-v1",
      sourceImageTransmitted: false
    }
  });

  const exported = JSON.parse(await storage.exportMetadata([{
    id: "frame-semantic",
    timestamp: context.capturedAt,
    imageDataUrl: "data:image/jpeg;base64,test",
    provider: "local-semantic-overlay",
    sceneSummary: context.conCamera.sceneSummary,
    context
  }]).text());

  assert.equal(exported[0].provider, "local-semantic-overlay");
  assert.equal(exported[0].sceneSummary, "hedgehog plushie, car; hedgehog plushie on top of car");
  assert.deepEqual(exported[0].overlaySettings, context.conCamera.overlaySettings);
  assert.deepEqual(exported[0].recognizedObjects, context.conCamera.recognizedObjects);
  assert.deepEqual(exported[0].objectRelationships, context.conCamera.objectRelationships);
  assert.equal(exported[0].context.conCamera.sourceImageTransmitted, false);
  assert.equal(exported[0].prompt, undefined);
});

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

function contextFixture(patch = {}) {
  const now = "2026-07-17T03:03:00.000Z";
  return {
    capturedAt: now,
    mode: "outdoor",
    time: {
      iso: now,
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
    cameraPose: {
      azimuthDeg: 237,
      pitchDeg: 0,
      rollDeg: 0,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt: Date.parse(now)
    },
    manualSettings: { ...DEFAULT_MANUAL_SETTINGS },
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
    },
    ...patch
  };
}
