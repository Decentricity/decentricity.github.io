import assert from "node:assert/strict";
import { test } from "node:test";
import { expandedFaceBox } from "../assets/faces/faceCrops.js";
import { selectFacesForSubjectMode } from "../assets/faces/faceSelection.js";
import { PromptBuilder } from "../assets/promptBuilder.js";

test("subject mapping matrix for zero detected faces uses synthetic subjects", () => {
  for (const mode of ["landscape", "single-person", "group", "crowd"]) {
    const selection = selectFacesForSubjectMode([], mode, "job-zero");
    assert.equal(selection.selectedFaceCount, 0);
    assert.equal(selection.strategy, "synthetic-subjects");
    assert.match(selection.promptInstruction, /No real faces were detected/);
  }
});

test("subject mapping matrix for one detected face preserves it according to mode", () => {
  const face = fakeFace("face-a", 0.08, 0.1);
  const byMode = {
    landscape: "environmental-likeness",
    "single-person": "preserved-hero",
    group: "preserved-plus-synthetic-group",
    crowd: "preserved-plus-synthetic-crowd"
  };

  for (const [mode, strategy] of Object.entries(byMode)) {
    const selection = selectFacesForSubjectMode([face], mode, "job-one");
    assert.deepEqual(selection.selectedFaceIds, ["face-a"]);
    assert.equal(selection.selectedFaceCount, 1);
    assert.equal(selection.strategy, strategy);
  }
});

test("subject mapping matrix for three detected faces selects deterministic subsets", () => {
  const faces = [
    fakeFace("face-a", 0.08, 0.2),
    fakeFace("face-b", 0.05, 0.4),
    fakeFace("face-c", 0.04, 0.1)
  ];

  const landscape = selectFacesForSubjectMode(faces, "landscape", "job-three");
  const person = selectFacesForSubjectMode(faces, "single-person", "job-three");
  const group = selectFacesForSubjectMode(faces, "group", "job-three");
  const crowd = selectFacesForSubjectMode(faces, "crowd", "job-three");

  assert.equal(landscape.selectedFaceCount, 1);
  assert.equal(person.selectedFaceCount, 1);
  assert.equal(group.selectedFaceCount, 3);
  assert.equal(crowd.selectedFaceCount, 3);
  assert.equal(new Set(crowd.selectedFaceIds).size, crowd.selectedFaceIds.length);
});

test("deterministic face selection is stable for retry and respects limits", () => {
  const faces = Array.from({ length: 8 }, (_, index) => fakeFace(`face-${index}`, 0.03 + index / 100, 0.2));
  const first = selectFacesForSubjectMode(faces, "crowd", "retry-job", 5);
  const second = selectFacesForSubjectMode(faces, "crowd", "retry-job", 5);

  assert.deepEqual(first.selectedFaceIds, second.selectedFaceIds);
  assert.equal(first.selectedFaceCount, 5);
  assert.equal(new Set(first.selectedFaceIds).size, 5);
});

test("face crop expansion includes head context and clamps to image bounds", () => {
  const center = expandedFaceBox(fakeFace("center", 0.04, 0.1, { x: 400, y: 300, width: 100, height: 120 }), 1000, 800);
  assert.ok(center.width >= 180);
  assert.ok(center.height >= 264);
  assert.ok(center.x >= 0);
  assert.ok(center.y >= 0);

  const edge = expandedFaceBox(fakeFace("edge", 0.04, 0.9, { x: 920, y: 20, width: 90, height: 100 }), 1000, 800);
  assert.ok(edge.x + edge.width <= 1000);
  assert.ok(edge.y + edge.height <= 800);
});

test("ConCamera prompt preserves selected faces and forbids landscape grotesquerie", () => {
  const selection = selectFacesForSubjectMode([fakeFace("face-a", 0.08, 0.1)], "landscape", "prompt-job");
  const prompt = new PromptBuilder().build(contextForPrompt("landscape"), selection);

  assert.match(prompt, /CONCAMERA IMAGE TRANSFORMATION/);
  assert.match(prompt, /PRIORITY 1 -- SELECTED HUMAN LIKENESS/);
  assert.match(prompt, /There are 1 selected real face references/);
  assert.match(prompt, /Incorporate the selected facial likeness indirectly/);
  assert.match(prompt, /Do not create a severed head/);
  assert.match(prompt, /Each selected face represents one distinct person/);
  assert.match(prompt, /Subject mode: landscape/);
});

test("person prompt excludes unselected source identities", () => {
  const faces = [fakeFace("face-a", 0.05, 0.1), fakeFace("face-b", 0.04, 0.2), fakeFace("face-c", 0.03, 0.3)];
  const selection = selectFacesForSubjectMode(faces, "single-person", "person-job");
  const prompt = new PromptBuilder().build(contextForPrompt("single-person"), selection);

  assert.equal(selection.selectedFaceCount, 1);
  assert.match(prompt, /Use only the selected reference person as the principal recognizable real person/);
  assert.match(prompt, /Unselected source faces must not be preserved as recognizable people/);
  assert.match(prompt, /Any incidental background people must be synthetic/);
});

function fakeFace(id, areaRatio, centerDistance, box = { x: 120, y: 100, width: 120, height: 140 }) {
  return {
    id,
    boundingBox: box,
    confidence: 0.9,
    areaRatio,
    centerDistance
  };
}

function contextForPrompt(subjectMode) {
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
      label: "Margo City, Beji, Depok, Indonesia"
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
      pitchDeg: 38.4,
      rollDeg: -7.2,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt: Date.parse(now)
    },
    manualSettings: {
      focusStyle: "deep-focus",
      exposureCompensationEv: 0,
      subjectMode,
      flashMode: "off",
      iso: 200
    },
    orientation: {
      status: "granted",
      aim: "Steeply upward"
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
