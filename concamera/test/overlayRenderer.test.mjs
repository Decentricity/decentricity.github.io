import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_MANUAL_SETTINGS } from "../assets/context/manualSettings.js";
import {
  SemanticOverlayRenderer,
  affordanceFor,
  risksFor,
  selectOverlayObjects,
  selectOverlayRelationships
} from "../assets/overlay/overlayRenderer.js";

test("overlay renderer preserves the source image beneath semantic graphics", async () => {
  const calls = [];
  const renderer = new SemanticOverlayRenderer(fakeOverlayDependencies(calls));
  const rendered = await renderer.render({
    source: sourcePhoto(),
    analysis: mouseLaptopAnalysis(),
    settings: { ...DEFAULT_MANUAL_SETTINGS, analysisMode: "taxonomy", overlayDensity: "normal" },
    timestamp: "2026-07-17T03:03:00.000Z"
  });

  assert.equal(rendered.imageDataUrl, "data:image/jpeg;base64,semantic-overlay");
  assert.equal(rendered.renderVersion, "semantic-overlay-v1");
  assert.deepEqual(calls[0], ["loadImage", sourcePhoto().dataUrl]);
  assert.deepEqual(calls[1], ["createCanvas", 1200, 900]);
  assert.deepEqual(calls[2], ["drawImage", 0, 0, 1200, 900]);
  assert.ok(calls.some((call) => call[0] === "fillText" && call[1] === "MOUSE"));
  assert.ok(calls.some((call) => call[0] === "fillText" && call[1] === "LAPTOP"));
});

test("overlay object selection respects density, confidence, salience, and relationship-critical objects", () => {
  const analysis = {
    objects: [
      object("low", "low confidence object", "other", 0.3, 0.99, { x: 0.1, y: 0.1, width: 0.1, height: 0.1 }),
      object("mouse", "mouse", "electronics", 0.8, 0.9, { x: 0.1, y: 0.5, width: 0.18, height: 0.12 }),
      object("laptop", "laptop", "electronics", 0.9, 0.7, { x: 0.35, y: 0.45, width: 0.35, height: 0.24 }),
      object("chair", "chair", "furniture", 0.75, 0.6, { x: 0.7, y: 0.4, width: 0.2, height: 0.3 }),
      object("book", "book", "other", 0.7, 0.5, { x: 0.2, y: 0.8, width: 0.16, height: 0.08 }),
      object("cup", "cup", "container", 0.65, 0.4, { x: 0.55, y: 0.75, width: 0.08, height: 0.12 })
    ],
    relationships: [
      { subjectObjectId: "mouse", predicate: "next-to", objectObjectId: "laptop", confidence: 0.8 }
    ],
    provider: "fixture",
    warnings: []
  };

  const minimal = selectOverlayObjects(analysis, {
    ...DEFAULT_MANUAL_SETTINGS,
    overlayDensity: "minimal",
    confidenceThreshold: 0.5,
    scanMode: "survey"
  });
  assert.ok(minimal.length <= 5);
  assert.deepEqual(minimal.slice(0, 2).map((candidate) => candidate.id).sort(), ["laptop", "mouse"]);
  assert.equal(minimal.some((candidate) => candidate.id === "low"), false);

  const focus = selectOverlayObjects(analysis, {
    ...DEFAULT_MANUAL_SETTINGS,
    overlayDensity: "full",
    confidenceThreshold: 0.5,
    scanMode: "focus"
  });
  assert.equal(focus.length, 4);

  const relationships = selectOverlayRelationships(analysis.relationships, minimal, DEFAULT_MANUAL_SETTINGS);
  assert.deepEqual(relationships.map((relationship) => relationship.predicate), ["next-to"]);
});

test("semantic mode draws relationship labels and relations switch removes connector graphics", async () => {
  const withRelations = [];
  const renderer = new SemanticOverlayRenderer(fakeOverlayDependencies(withRelations));
  await renderer.render({
    source: sourcePhoto(),
    analysis: mouseLaptopAnalysis(),
    settings: { ...DEFAULT_MANUAL_SETTINGS, analysisMode: "semantic", relationsVisible: true, boxesVisible: false },
    timestamp: "2026-07-17T03:03:00.000Z"
  });
  assert.ok(withRelations.some((call) => call[0] === "lineTo"));
  assert.ok(withRelations.some((call) => call[0] === "fillText" && /MOUSE NEXT TO LAPTOP/.test(call[1])));

  const withoutRelations = [];
  const rendererWithoutRelations = new SemanticOverlayRenderer(fakeOverlayDependencies(withoutRelations));
  await rendererWithoutRelations.render({
    source: sourcePhoto(),
    analysis: mouseLaptopAnalysis(),
    settings: { ...DEFAULT_MANUAL_SETTINGS, analysisMode: "semantic", relationsVisible: false, boxesVisible: false },
    timestamp: "2026-07-17T03:03:00.000Z"
  });
  assert.equal(withoutRelations.some((call) => call[0] === "lineTo"), false);
});

test("boxes switch removes box geometry while retaining anchored labels", async () => {
  const calls = [];
  const renderer = new SemanticOverlayRenderer(fakeOverlayDependencies(calls));
  await renderer.render({
    source: sourcePhoto(),
    analysis: mouseLaptopAnalysis(),
    settings: { ...DEFAULT_MANUAL_SETTINGS, boxesVisible: false, relationsVisible: false },
    timestamp: "2026-07-17T03:03:00.000Z"
  });

  assert.equal(calls.some((call) => call[0] === "lineTo"), false);
  assert.ok(calls.some((call) => call[0] === "fillText" && call[1] === "MOUSE"));
});

test("affordance and risk modes use conservative local rules", async () => {
  assert.deepEqual(affordanceFor("mouse"), ["POINT", "CLICK"]);
  assert.deepEqual(affordanceFor("laptop"), []);
  assert.deepEqual(affordanceFor("mystery object"), []);

  const vehicle = object("car", "car", "vehicle", 0.9, 0.9, { x: 0.34, y: 0.42, width: 0.3, height: 0.32 });
  const knife = object("knife", "knife", "tool", 0.9, 0.8, { x: 0.1, y: 0.2, width: 0.1, height: 0.2 });
  assert.ok(risksFor(vehicle).includes("POSSIBLE VEHICLE NEARBY"));
  assert.ok(risksFor(knife).includes("POSSIBLE SHARP OBJECT"));

  const calls = [];
  const renderer = new SemanticOverlayRenderer(fakeOverlayDependencies(calls));
  await renderer.render({
    source: sourcePhoto(),
    analysis: {
      objects: [
        object("chair", "chair", "furniture", 0.9, 0.8, { x: 0.1, y: 0.4, width: 0.2, height: 0.3 }),
        vehicle
      ],
      relationships: [],
      provider: "fixture",
      warnings: []
    },
    settings: { ...DEFAULT_MANUAL_SETTINGS, analysisMode: "affordance" },
    timestamp: "2026-07-17T03:03:00.000Z"
  });
  assert.ok(calls.some((call) => call[0] === "fillText" && /CHAIR -> SIT/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === "fillText" && /CAR -> DRIVE/.test(call[1])));
});

test("canonical plushie-on-car overlay keeps the original photo and semantic relationship", async () => {
  const calls = [];
  const renderer = new SemanticOverlayRenderer(fakeOverlayDependencies(calls));
  const rendered = await renderer.render({
    source: sourcePhoto(),
    analysis: {
      objects: [
        object("plushie", "hedgehog plushie", "toy", 0.96, 0.95, { x: 0.42, y: 0.12, width: 0.16, height: 0.14 }),
        object("car", "car", "vehicle", 0.98, 0.9, { x: 0.1, y: 0.35, width: 0.82, height: 0.38 })
      ],
      relationships: [
        { subjectObjectId: "plushie", predicate: "on-top-of", objectObjectId: "car", confidence: 0.91 }
      ],
      provider: "fixture",
      warnings: []
    },
    settings: { ...DEFAULT_MANUAL_SETTINGS, analysisMode: "semantic", overlayDensity: "full" },
    timestamp: "2026-07-17T03:03:00.000Z"
  });

  assert.ok(calls.some((call) => call[0] === "drawImage"));
  assert.ok(calls.some((call) => call[0] === "fillText" && /HEDGEHOG PLUSHIE/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === "fillText" && /CAR/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === "fillText" && /ON TOP OF/.test(call[1])));
  assert.match(rendered.sceneSummary, /hedgehog plushie/);
  assert.match(rendered.sceneSummary, /on top of/);
});

test("recognition failure renders the original image with analysis-unavailable overlay", async () => {
  const calls = [];
  const renderer = new SemanticOverlayRenderer(fakeOverlayDependencies(calls));
  const rendered = await renderer.render({
    source: sourcePhoto(),
    analysis: {
      objects: [],
      relationships: [],
      provider: "local-cnn",
      warnings: ["model unavailable"]
    },
    settings: DEFAULT_MANUAL_SETTINGS,
    timestamp: "2026-07-17T03:03:00.000Z"
  });

  assert.ok(calls.some((call) => call[0] === "drawImage"));
  assert.ok(calls.some((call) => call[0] === "fillText" && call[1] === "ANALYSIS UNAVAILABLE"));
  assert.match(rendered.sceneSummary, /Analysis unavailable/);
});

function fakeOverlayDependencies(calls) {
  let now = 1_000;
  return {
    async loadImage(src) {
      calls.push(["loadImage", src]);
      return { width: 1200, height: 900 };
    },
    createCanvas(width, height) {
      calls.push(["createCanvas", width, height]);
      return {
        width,
        height,
        getContext() {
          return fakeContext(calls);
        },
        toDataURL(type, quality) {
          calls.push(["toDataURL", type, quality]);
          return "data:image/jpeg;base64,semantic-overlay";
        }
      };
    },
    now() {
      now += 13;
      return now;
    }
  };
}

function fakeContext(calls) {
  return {
    fillStyle: "",
    strokeStyle: "",
    shadowColor: "",
    shadowBlur: 0,
    lineWidth: 1,
    font: "",
    textBaseline: "",
    textAlign: "",
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    beginPath: () => calls.push(["beginPath"]),
    moveTo: (...args) => calls.push(["moveTo", ...args]),
    lineTo: (...args) => calls.push(["lineTo", ...args]),
    stroke: () => calls.push(["stroke"]),
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    strokeRect: (...args) => calls.push(["strokeRect", ...args]),
    drawImage: (_image, ...args) => calls.push(["drawImage", ...args]),
    fillText: (...args) => calls.push(["fillText", ...args]),
    measureText(text) {
      return {
        width: String(text).length * 8,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 4
      };
    }
  };
}

function mouseLaptopAnalysis() {
  return {
    objects: [
      object("mouse", "mouse", "electronics", 0.88, 0.9, { x: 0.18, y: 0.58, width: 0.13, height: 0.08 }),
      object("laptop", "laptop", "electronics", 0.91, 0.86, { x: 0.36, y: 0.42, width: 0.34, height: 0.22 })
    ],
    relationships: [
      { subjectObjectId: "mouse", predicate: "next-to", objectObjectId: "laptop", confidence: 0.82 }
    ],
    provider: "fixture",
    warnings: []
  };
}

function object(id, label, category, confidence, salience, boundingBox) {
  return {
    id,
    label,
    normalizedLabel: label,
    category,
    boundingBox,
    confidence,
    salience,
    attributes: []
  };
}

function sourcePhoto() {
  return {
    blob: new Blob(["source"], { type: "image/jpeg" }),
    dataUrl: "data:image/jpeg;base64,source",
    width: 1200,
    height: 900,
    capturedAt: "2026-07-17T03:03:00.000Z",
    estimatedBytes: 1024
  };
}
