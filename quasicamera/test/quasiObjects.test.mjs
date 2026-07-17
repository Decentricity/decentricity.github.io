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
import { OpenAIObjectAnalyzer } from "../assets/objects/objectAnalyzer.js";
import { OpenAIKeyStore } from "../assets/image/keyStore.js";
import { PromptBuilder } from "../assets/promptBuilder.js";
import { selectFacesForSubjectMode } from "../assets/faces/faceSelection.js";

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

test("OpenAI object analyzer sends a structured vision request and validates returned JSON", async () => {
  const fetchCalls = [];
  const fetchMock = async (url, init) => {
    fetchCalls.push({ url, init });
    return new Response(JSON.stringify({
      output_text: JSON.stringify(hedgehogOnCarFixture())
    }), { status: 200 });
  };
  const storage = fakeStorage();
  storage.setItem("quasicamera.openai.key", "sk-test");
  const analyzer = new OpenAIObjectAnalyzer(new OpenAIKeyStore(), fetchMock, 100);
  globalThis.localStorage = storage;

  const analysis = await analyzer.analyze(sourcePhoto());
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://api.openai.com/v1/responses");
  const body = JSON.parse(fetchCalls[0].init.body);
  assert.equal(body.model, "gpt-5.6");
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.name, "quasicamera_object_analysis");
  assert.match(JSON.stringify(body.input), /input_image/);
  assert.match(JSON.stringify(body.input), /Do not emit humans as objects/);
  assert.match(JSON.stringify(body.input), /license plates/);
  assert.deepEqual(analysis.objects.map((object) => object.normalizedLabel), ["hedgehog plushie", "car"]);
  assert.equal(analysis.relationships[0].predicate, "on-top-of");
});

test("OpenAI object analyzer returns nonfatal empty analysis when key is missing", async () => {
  globalThis.localStorage = fakeStorage();
  const analyzer = new OpenAIObjectAnalyzer(new OpenAIKeyStore(), async () => {
    throw new Error("fetch should not be called");
  }, 100);

  const analysis = await analyzer.analyze(sourcePhoto());
  assert.deepEqual(analysis.objects, []);
  assert.deepEqual(analysis.relationships, []);
  assert.equal(analysis.provider, "openai-vision-unavailable");
  assert.match(analysis.warnings.join(" "), /key unavailable/i);
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
