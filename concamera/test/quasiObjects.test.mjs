import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_PRESERVED_OBJECTS,
  MAX_PRESERVED_RELATIONSHIPS,
  normalizeObjectLabel,
  normalizePredicate,
  toPersistedObjectMetadata,
  validateObjectAnalysis
} from "../assets/objects/objectNormalization.js";
import {
  containsBox,
  deriveRelationships,
  horizontalOverlap,
  intersectionOverUnion,
  LocalCnnObjectAnalyzer,
  salienceScore
} from "../assets/objects/localCnnObjectAnalyzer.js";
import { PromptBuilder } from "../assets/promptBuilder.js";
import { selectFacesForSubjectMode } from "../assets/faces/faceSelection.js";
import { readFile } from "node:fs/promises";

test("object label normalization preserves useful semantics without brands", () => {
  assert.equal(normalizeObjectLabel("red 2018 Toyota Avanza"), "car");
  assert.equal(normalizeObjectLabel("red sedan"), "car");
  assert.equal(normalizeObjectLabel("small gray hedgehog stuffed animal"), "hedgehog plushie");
  assert.equal(normalizeObjectLabel("black Apple MacBook Pro"), "laptop");
  assert.equal(normalizeObjectLabel("wheelchair"), "wheelchair");
  assert.equal(normalizeObjectLabel("motorbike"), "motorcycle");
  assert.equal(normalizeObjectLabel("person"), null);
  assert.equal(normalizeObjectLabel("woman's face"), null);
});

test("relationship predicates normalize to supported preservation relationships", () => {
  assert.equal(normalizePredicate("plushie resting on roof of car"), "on-top-of");
  assert.equal(normalizePredicate("cat within cardboard box"), "inside");
  assert.equal(normalizePredicate("leaning against"), "attached-to");
  assert.equal(normalizePredicate("teleporting through"), null);
});

test("canonical hedgehog plushie on car fixture validates with relationship intact", () => {
  const analysis = validateObjectAnalysis(hedgehogOnCarFixture(), "fixture-provider");

  assert.deepEqual(
    analysis.objects.map((object) => ({
      id: object.id,
      label: object.label,
      normalizedLabel: object.normalizedLabel,
      category: object.category
    })),
    [
      {
        id: "object-1",
        label: "small gray hedgehog stuffed animal",
        normalizedLabel: "hedgehog plushie",
        category: "toy"
      },
      {
        id: "object-2",
        label: "red 2018 Toyota Avanza",
        normalizedLabel: "car",
        category: "vehicle"
      }
    ]
  );
  assert.deepEqual(analysis.relationships, [
    {
      subjectObjectId: "object-1",
      predicate: "on-top-of",
      objectObjectId: "object-2",
      confidence: 0.91
    }
  ]);
});

test("schema validation removes humans, duplicates, unsupported predicates, and malformed relationships", () => {
  const analysis = validateObjectAnalysis({
    objects: [
      objectRecord("toy-1", "hedgehog plushie", "toy", 0.8),
      objectRecord("toy-2", "hedgehog stuffed animal", "toy", 0.6),
      objectRecord("person-1", "person", "other", 1),
      objectRecord("car-1", "sedan", "vehicle", 0.9)
    ],
    relationships: [
      { subjectObjectId: "toy-1", predicate: "on top of", objectObjectId: "car-1", confidence: 0.9 },
      { subjectObjectId: "toy-1", predicate: "on top of", objectObjectId: "car-1", confidence: 0.9 },
      { subjectObjectId: "toy-1", predicate: "teleporting through", objectObjectId: "car-1", confidence: 0.9 },
      { subjectObjectId: "toy-1", predicate: "inside", objectObjectId: "toy-1", confidence: 0.9 },
      { subjectObjectId: "toy-1", predicate: "next to", objectObjectId: "missing", confidence: 0.9 },
      { subjectObjectId: "toy-1", predicate: "under", objectObjectId: "car-1", confidence: 0.05 }
    ],
    warnings: []
  });

  assert.deepEqual(analysis.objects.map((object) => object.normalizedLabel), ["car", "hedgehog plushie"]);
  assert.equal(analysis.relationships.length, 1);
  assert.equal(analysis.relationships[0].predicate, "on-top-of");
  assert.ok(analysis.warnings.some((warning) => /human-like/.test(warning)));
  assert.ok(analysis.warnings.some((warning) => /malformed object relationship/.test(warning)));
  assert.ok(analysis.warnings.some((warning) => /self-referential/.test(warning)));
  assert.ok(analysis.warnings.some((warning) => /omitted object/.test(warning)));
  assert.ok(analysis.warnings.some((warning) => /low confidence/.test(warning)));
});

test("salience limit keeps relationship-critical objects and records omitted low-salience objects", () => {
  const objects = Array.from({ length: MAX_PRESERVED_OBJECTS + 3 }, (_, index) => (
    objectRecord(`object-${index}`, index === MAX_PRESERVED_OBJECTS + 2 ? "cardboard box" : `generic item ${index}`, "other", index / 20)
  ));
  objects[0].label = "hedgehog plushie";
  objects[0].normalizedLabel = "hedgehog plushie";
  objects[0].category = "toy";
  objects[MAX_PRESERVED_OBJECTS + 2].category = "container";

  const analysis = validateObjectAnalysis({
    objects,
    relationships: [
      {
        subjectObjectId: "object-0",
        predicate: "inside",
        objectObjectId: `object-${MAX_PRESERVED_OBJECTS + 2}`,
        confidence: 0.9
      }
    ],
    warnings: []
  });

  assert.equal(analysis.objects.length, MAX_PRESERVED_OBJECTS);
  assert.ok(analysis.objects.some((object) => object.normalizedLabel === "hedgehog plushie"));
  assert.ok(analysis.objects.some((object) => object.normalizedLabel === "box"));
  assert.equal(analysis.relationships.length, 1);
  assert.ok((analysis.omittedObjects?.length ?? 0) > 0);
});

test("relationship limit caps validated relationships", () => {
  const labels = ["hedgehog plushie", "car", "laptop", "wheelchair"];
  const rawObjects = labels.map((label, index) => objectRecord(`object-${index}`, label, index === 1 ? "vehicle" : "other", 0.9 - index / 10));
  const relationships = Array.from({ length: MAX_PRESERVED_RELATIONSHIPS + 3 }, (_, index) => ({
    subjectObjectId: `object-${index % 2}`,
    predicate: index % 2 === 0 ? "next to" : "attached to",
    objectObjectId: `object-${2 + (index % 2)}`,
    confidence: 0.8
  }));

  const analysis = validateObjectAnalysis({ objects: rawObjects, relationships, warnings: [] });
  assert.equal(analysis.relationships.length, 2);
  assert.ok(analysis.relationships.length <= MAX_PRESERVED_RELATIONSHIPS);
});

test("malformed object output degrades to no semantic constraints", () => {
  const analysis = validateObjectAnalysis("not-json");
  assert.deepEqual(analysis.objects, []);
  assert.deepEqual(analysis.relationships, []);
  assert.match(analysis.warnings.join(" "), /malformed/);
});

test("persisted metadata contains concepts and relationships but no source boxes", () => {
  const analysis = validateObjectAnalysis(hedgehogOnCarFixture(), "fixture-provider");
  const metadata = toPersistedObjectMetadata(analysis);

  assert.deepEqual(metadata.recognizedObjects.map((object) => ({
    label: object.label,
    category: object.category
  })), [
    { label: "hedgehog plushie", category: "toy" },
    { label: "car", category: "vehicle" }
  ]);
  assert.deepEqual(metadata.objectRelationships, [
    { subject: "hedgehog plushie", predicate: "on-top-of", object: "car" }
  ]);
  assert.doesNotMatch(JSON.stringify(metadata), /boundingBox|x|width|source/);
});

test("object prompt appends semantic preservation without weakening face instructions", () => {
  const objectAnalysis = validateObjectAnalysis(hedgehogOnCarFixture(), "fixture-provider");
  const oneFace = [fakeFace("face-a")];

  for (const mode of ["landscape", "single-person", "group", "crowd"]) {
    const selection = selectFacesForSubjectMode(oneFace, mode, `object-prompt-${mode}`);
    const prompt = new PromptBuilder().build(contextForPrompt(mode), selection, objectAnalysis);

    assert.match(prompt, /PRESERVE SELECTED HUMAN LIKENESS/);
    assert.match(prompt, /Each selected face represents one distinct person/);
    assert.match(prompt, /Non-human objects require semantic preservation only/);
    assert.match(prompt, /hedgehog plushie/);
    assert.match(prompt, /car/);
    assert.match(prompt, /on top of/);
    assert.match(prompt, /does not need to be the exact same physical object/);
    assert.match(prompt, /The target car does not need to resemble the source car/);
    assert.match(prompt, /The target hedgehog plushie does not need to resemble the source plushie/);
    assert.match(prompt, /Do not duplicate a selected person/);
  }
});

test("prompt covers zero, one, and multiple faces with the same object constraints", () => {
  const objectAnalysis = validateObjectAnalysis(hedgehogOnCarFixture(), "fixture-provider");
  const faceSets = [
    [],
    [fakeFace("face-a")],
    [fakeFace("face-a"), fakeFace("face-b"), fakeFace("face-c")]
  ];

  for (const faces of faceSets) {
    const selection = selectFacesForSubjectMode(faces, "crowd", `faces-${faces.length}`);
    const prompt = new PromptBuilder().build(contextForPrompt("crowd"), selection, objectAnalysis);
    assert.match(prompt, /Selected source faces:/);
    assert.match(prompt, /hedgehog plushie/);
    assert.match(prompt, /on top of the car/);
    assert.match(prompt, /Object semantics/iu);
  }
});

test("landscape object prompt forbids grotesque disembodied face handling through face rules", () => {
  const objectAnalysis = validateObjectAnalysis(hedgehogOnCarFixture(), "fixture-provider");
  const selection = selectFacesForSubjectMode([fakeFace("face-a")], "landscape", "landscape-object");
  const prompt = new PromptBuilder().build(contextForPrompt("landscape"), selection, objectAnalysis);

  assert.match(prompt, /Incorporate the selected facial likeness indirectly/);
  assert.match(prompt, /must not become a grotesque biological object/);
  assert.match(prompt, /Do not create a severed head/);
  assert.match(prompt, /hedgehog plushie/);
});

test("local CNN analyzer filters humans, applies confidence threshold, and normalizes source coordinates", async () => {
  const detector = fakeDetector([
    { class: "person", score: 0.99, bbox: [50, 40, 100, 220] },
    { class: "cup", score: 0.2, bbox: [400, 300, 80, 120] },
    { class: "car", score: 0.86, bbox: [100, 200, 300, 400] }
  ]);
  const analyzer = new LocalCnnObjectAnalyzer({
    detector,
    classifier: null,
    createAnalysisInput: testAnalysisInput(1000, 1000)
  });

  const analysis = await analyzer.analyze(sourcePhoto());

  assert.equal(detector.calls.length, 1);
  assert.equal(analysis.provider, "local-cnn:coco-ssd+mobilenet");
  assert.deepEqual(analysis.objects.map((object) => object.normalizedLabel), ["car"]);
  assert.deepEqual(analysis.objects[0].boundingBox, { x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  assert.equal(analysis.metrics.detector, "mock-coco-ssd");
  assert.equal(analysis.metrics.classifier, null);
  assert.equal(analysis.metrics.backend, "mock");
  assert.equal(analysis.metrics.detectedCount, 1);
  assert.equal(analysis.metrics.preservedCount, 1);
  assert.equal(analysis.metrics.modelStatus, "ready");
});

test("local CNN analyzer fuses teddy-bear detection with hedgehog classifier evidence", async () => {
  const detector = fakeDetector([
    { class: "teddy bear", score: 0.92, bbox: [420, 120, 160, 140] },
    { class: "car", score: 0.96, bbox: [100, 280, 820, 380] }
  ]);
  const classifier = fakeClassifier([
    { className: "hedgehog", probability: 0.4 },
    { className: "stuffed toy", probability: 0.35 }
  ]);
  const analyzer = new LocalCnnObjectAnalyzer({
    detector,
    classifier,
    createAnalysisInput: testAnalysisInput(1000, 1000),
    createCropInput: () => ({})
  });

  const analysis = await analyzer.analyze(sourcePhoto());
  const labels = analysis.objects.map((object) => object.normalizedLabel);
  assert.ok(labels.includes("hedgehog plushie"));
  assert.ok(labels.includes("car"));
  assert.deepEqual(analysis.relationships.map((relationship) => relationship.predicate), ["on-top-of"]);
  assert.equal(classifier.calls.length, 1);
  assert.equal(analysis.metrics.classifier, "mock-mobilenet");
});

test("local CNN geometry derives conservative spatial relationships", () => {
  const plushie = geometryObject("plushie", "hedgehog plushie", { x: 0.42, y: 0.12, width: 0.16, height: 0.14 });
  const car = geometryObject("car", "car", { x: 0.1, y: 0.28, width: 0.82, height: 0.38 });
  const farPlushie = geometryObject("far-plushie", "hedgehog plushie", { x: 0, y: 0.38, width: 0.08, height: 0.1 });
  const box = geometryObject("box", "box", { x: 0.34, y: 0.3, width: 0.28, height: 0.28 });
  const cat = geometryObject("cat", "cat", { x: 0.4, y: 0.36, width: 0.12, height: 0.12 });
  const cup = geometryObject("cup", "cup", { x: 0.45, y: 0.32, width: 0.08, height: 0.12 });
  const table = geometryObject("table", "table", { x: 0.28, y: 0.45, width: 0.44, height: 0.2 });
  const distantRock = geometryObject("rock", "rock", { x: 0.83, y: 0.82, width: 0.08, height: 0.08 });

  assert.equal(relationshipBetween([plushie, car], "plushie", "car"), "on-top-of");
  assert.equal(relationshipBetween([farPlushie, car], "far-plushie", "car"), "next-to");
  assert.equal(relationshipBetween([cat, box], "cat", "box"), "inside");
  assert.equal(relationshipBetween([cup, table], "cup", "table"), "on-top-of");
  assert.equal(relationshipBetween([plushie, distantRock], "plushie", "rock"), undefined);

  assert.ok(intersectionOverUnion(cat.boundingBox, box.boundingBox) > 0);
  assert.ok(horizontalOverlap(plushie.boundingBox, car.boundingBox) > 0);
  assert.equal(containsBox(box.boundingBox, cat.boundingBox), true);
  assert.ok(salienceScore(plushie.boundingBox, 0.9, "hedgehog plushie") > salienceScore(distantRock.boundingBox, 0.5, "rock"));
});

test("local CNN analyzer degrades nonfatally on model-load or inference failure and disposes inputs", async () => {
  const modelFailure = await new LocalCnnObjectAnalyzer({
    runtimeLoader: async () => {
      throw new Error("WebGL unavailable");
    },
    createAnalysisInput: testAnalysisInput(1000, 1000)
  }).analyze(sourcePhoto());

  assert.deepEqual(modelFailure.objects, []);
  assert.deepEqual(modelFailure.relationships, []);
  assert.match(modelFailure.warnings.join(" "), /WebGL unavailable/);
  assert.equal(modelFailure.metrics.modelStatus, "failed");

  let disposed = 0;
  const inferenceFailure = await new LocalCnnObjectAnalyzer({
    detector: {
      async detect() {
        throw new Error("detector exploded");
      }
    },
    createAnalysisInput: testAnalysisInput(1000, 1000, () => {
      disposed += 1;
    })
  }).analyze(sourcePhoto());

  assert.deepEqual(inferenceFailure.objects, []);
  assert.match(inferenceFailure.warnings.join(" "), /detector exploded/);
  assert.equal(disposed, 1);
});

test("ConCamera object recognition contains no remote OpenAI object-analysis endpoint", async () => {
  const files = await Promise.all([
    readFile(new URL("../assets/objects/objectAnalyzer.js", import.meta.url), "utf8"),
    readFile(new URL("../assets/objects/localCnnObjectAnalyzer.js", import.meta.url), "utf8"),
    readFile(new URL("../assets/ui/app.js", import.meta.url), "utf8")
  ]);
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /\/v1\/responses/);
  assert.doesNotMatch(combined, /OpenAIObjectAnalyzer/);
});

function hedgehogOnCarFixture() {
  return {
    objects: [
      {
        id: "object-1",
        label: "small gray hedgehog stuffed animal",
        normalizedLabel: "hedgehog stuffed animal",
        category: "toy",
        boundingBox: { x: 0.42, y: 0.12, width: 0.16, height: 0.14 },
        confidence: 0.94,
        salience: 0.95,
        attributes: ["small", "stuffed animal"],
        count: null
      },
      {
        id: "object-2",
        label: "red 2018 Toyota Avanza",
        normalizedLabel: "Toyota Avanza sedan",
        category: "vehicle",
        boundingBox: { x: 0.1, y: 0.35, width: 0.82, height: 0.38 },
        confidence: 0.96,
        salience: 0.9,
        attributes: ["red"],
        count: null
      }
    ],
    relationships: [
      {
        subjectObjectId: "object-1",
        predicate: "plushie resting on roof of car",
        objectObjectId: "object-2",
        confidence: 0.91
      }
    ],
    warnings: []
  };
}

function objectRecord(id, label, category, salience) {
  return {
    id,
    label,
    normalizedLabel: label,
    category,
    boundingBox: null,
    confidence: 0.8,
    salience,
    attributes: [],
    count: null
  };
}

function fakeFace(id) {
  return {
    id,
    boundingBox: { x: 200, y: 120, width: 160, height: 180 },
    confidence: 0.9,
    areaRatio: 0.04,
    centerDistance: 0.1
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

function fakeDetector(detections) {
  return {
    calls: [],
    async detect(input) {
      this.calls.push(input);
      return detections;
    }
  };
}

function fakeClassifier(classifications) {
  return {
    calls: [],
    async classify(input) {
      this.calls.push(input);
      return classifications;
    }
  };
}

function testAnalysisInput(width, height, dispose = () => undefined) {
  return async () => ({
    image: {},
    width,
    height,
    dispose
  });
}

function geometryObject(id, label, boundingBox) {
  return {
    id,
    label,
    normalizedLabel: label,
    category: label === "car" ? "vehicle" : label === "box" ? "container" : label === "hedgehog plushie" ? "toy" : "other",
    boundingBox,
    confidence: 0.9,
    salience: 0.9,
    attributes: []
  };
}

function relationshipBetween(objects, subjectId, objectId) {
  return deriveRelationships(objects)
    .find((relationship) => relationship.subjectObjectId === subjectId && relationship.objectObjectId === objectId)
    ?.predicate;
}
