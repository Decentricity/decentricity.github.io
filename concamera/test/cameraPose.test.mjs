import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aimLabelForPitch,
  cameraPoseFromDeviceOrientation,
  cameraPoseWithFreshness,
  freezeCameraPose,
  smoothCameraPose
} from "../assets/context/cameraPose.js";

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
