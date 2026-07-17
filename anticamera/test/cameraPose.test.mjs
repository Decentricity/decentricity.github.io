import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aimLabelForPitch,
  cameraPoseFromDeviceOrientation,
  cameraPoseWithFreshness,
  freezeCameraPose,
  smoothCameraPose
} from "../assets/context/cameraPose.js";
import { PromptBuilder } from "../assets/promptBuilder.js";

function sample(alpha, beta, gamma, screenOrientationDeg = 0) {
  return {
    alpha,
    beta,
    gamma,
    screenOrientationDeg,
    capturedAt: 1_000
  };
}

function near(actual, expected, tolerance = 0.8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);
}

function nearAngle(actual, expected, tolerance = 0.8) {
  const delta = Math.abs((((actual - expected) % 360) + 540) % 360 - 180);
  assert.ok(delta <= tolerance, `${actual} not within ${tolerance} deg of ${expected}`);
}

test("portrait orientation, level and north-facing", () => {
  const pose = cameraPoseFromDeviceOrientation(sample(0, 90, 0, 0));
  nearAngle(pose.azimuthDeg, 0);
  near(pose.pitchDeg, 0);
  near(pose.rollDeg, 0);
  assert.equal(pose.screenOrientationDeg, 0);
  assert.equal(pose.confidence, "high");
});

test("landscape-left conversion preserves level north-facing camera pose", () => {
  const pose = cameraPoseFromDeviceOrientation(sample(90, 0, -90, 90));
  nearAngle(pose.azimuthDeg, 0);
  near(pose.pitchDeg, 0);
  near(pose.rollDeg, 0);
  assert.equal(pose.screenOrientationDeg, 90);
});

test("landscape-right conversion preserves level north-facing camera pose", () => {
  const pose = cameraPoseFromDeviceOrientation(sample(270, 0, 90, 270));
  nearAngle(pose.azimuthDeg, 0);
  near(pose.pitchDeg, 0);
  near(pose.rollDeg, 0);
  assert.equal(pose.screenOrientationDeg, 270);
});

test("nearly straight upward", () => {
  const pose = cameraPoseFromDeviceOrientation(sample(0, 170, 0, 0));
  nearAngle(pose.azimuthDeg, 0);
  near(pose.pitchDeg, 80);
  assert.equal(aimLabelForPitch(pose.pitchDeg), "Almost straight up");
});

test("nearly straight downward", () => {
  const pose = cameraPoseFromDeviceOrientation(sample(0, 10, 0, 0));
  nearAngle(pose.azimuthDeg, 0);
  near(pose.pitchDeg, -80);
  assert.equal(aimLabelForPitch(pose.pitchDeg), "Almost straight down");
});

test("30 degree clockwise roll", () => {
  const pose = cameraPoseFromDeviceOrientation(sample(90, 120, -90, 0));
  nearAngle(pose.azimuthDeg, 0);
  near(pose.pitchDeg, 0);
  near(pose.rollDeg, 30);
});

test("azimuth smoothing wraps 359 and 1 degrees through north", () => {
  const previous = {
    azimuthDeg: 359,
    pitchDeg: 0,
    rollDeg: 0,
    screenOrientationDeg: 0,
    confidence: "high",
    capturedAt: 1
  };
  const next = {
    ...previous,
    azimuthDeg: 1,
    capturedAt: 2
  };
  const smoothed = smoothCameraPose(previous, next, 0.5);
  nearAngle(smoothed.azimuthDeg, 0);
});

test("freezing pose at shutter time returns an immutable snapshot copy", () => {
  const live = {
    azimuthDeg: 237,
    pitchDeg: 38.4,
    rollDeg: -7.2,
    screenOrientationDeg: 0,
    confidence: "high",
    capturedAt: 1_000
  };
  const frozen = freezeCameraPose(live, 2_000);
  live.azimuthDeg = 42;
  live.pitchDeg = -20;
  assert.equal(frozen.azimuthDeg, 237);
  assert.equal(frozen.pitchDeg, 38.4);
  assert.equal(frozen.capturedAt, 2_000);
});

test("unavailable orientation sensor degrades gracefully", () => {
  const pose = cameraPoseFromDeviceOrientation(sample(null, null, null, 0));
  assert.equal(pose.azimuthDeg, null);
  assert.equal(pose.pitchDeg, null);
  assert.equal(pose.rollDeg, null);
  assert.equal(pose.confidence, "low");
});

test("stale sensor sample lowers confidence", () => {
  const pose = {
    azimuthDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    screenOrientationDeg: 0,
    confidence: "high",
    capturedAt: 0
  };
  assert.equal(cameraPoseWithFreshness(pose, 5_000).confidence, "low");
});

test("prompt explicitly preserves pitch and roll", () => {
  const prompt = new PromptBuilder().build(contextForPrompt({
    azimuthDeg: 237,
    pitchDeg: 38.4,
    rollDeg: -7.2,
    screenOrientationDeg: 0,
    confidence: "high",
    capturedAt: 2_000
  }));

  assert.match(prompt, /CAMERA POSE -- STRICT COMPOSITIONAL CONSTRAINT/);
  assert.match(prompt, /azimuth 237\.0 degrees southwest/);
  assert.match(prompt, /pitched \+38\.4 degrees/);
  assert.match(prompt, /rolled -7\.2 degrees/);
  assert.match(prompt, /horizon tilted by approximately 7\.2 degrees/);
  assert.match(prompt, /Do not automatically straighten the image/);
  assert.match(prompt, /22 mm full-frame-equivalent rectilinear lens/);
  assert.match(prompt, /substantially more sky, ceiling, treetops, upper floors, signage, or overhead structure than ground/);
});

function contextForPrompt(cameraPose) {
  return {
    capturedAt: "2026-07-17T00:00:02.000Z",
    mode: "outdoor",
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
    orientation: {
      status: "granted",
      alpha: 0,
      beta: 90,
      gamma: 0,
      aim: "Steeply upward"
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
