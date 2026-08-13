import test from "node:test";
import assert from "node:assert/strict";
import { VadGate, BoundedQueue, trimContext, parseDecision, compactGloss, classifyApiError, encodeWav } from "../core.mjs";

test("VAD starts after sustained speech and ends after silence", () => {
  const gate = new VadGate({ startMs: 100, endMs: 200 });
  assert.equal(gate.update(0.04, 50), "candidate");
  assert.equal(gate.update(0.04, 50), "start");
  assert.equal(gate.update(0.04, 50), "speech");
  assert.equal(gate.update(0.001, 100), "silence");
  assert.equal(gate.update(0.001, 100), "end");
  assert.equal(gate.speaking, false);
});

test("bounded queue drops the oldest and ignores stale work", () => {
  const queue = new BoundedQueue(2, 1000);
  queue.push({ id: 1 }, 0);
  queue.push({ id: 2 }, 10);
  queue.push({ id: 3 }, 20);
  assert.equal(queue.shift(20).id, 2);
  assert.equal(queue.shift(2000), undefined);
});

test("context trimming keeps the most recent useful entries", () => {
  const result = trimContext([{ text: "one" }, { text: "two" }, { text: "three" }], 8, 2);
  assert.deepEqual(result.map((entry) => entry.text), ["two", "three"]);
});

test("decision parsing validates and normalizes model JSON", () => {
  const result = parseDecision('```json\n{"should_speak":true,"explanation":"A short note.","reason":"jargon"}\n```');
  assert.deepEqual(result, { should_speak: true, explanation: "A short note.", reason: "jargon" });
  assert.throws(() => parseDecision('{"explanation":"missing boolean"}'));
});

test("spoken glosses lose filler and stay under 12 words", () => {
  assert.equal(compactGloss("This refers to Bitcoin Improvement Plan 110: small blocks; Bitcoin as payments only."), "Bitcoin Improvement Plan 110: small blocks; Bitcoin as payments only.");
  const longGloss = compactGloss("Certainly, one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three");
  assert.equal(longGloss.split(/\s+/).length, 12);
  assert.match(longGloss, /…$/);
});

test("API errors are classified for actionable UI", () => {
  assert.match(classifyApiError(401), /key was rejected/i);
  assert.match(classifyApiError(429), /rate limit/i);
  assert.match(classifyApiError(0, "Failed to fetch"), /disable any VPN/i);
});

test("WAV encoder emits a valid mono 16-bit header", async () => {
  const blob = encodeWav(new Float32Array(4800).fill(0.25), 48000, 16000);
  const view = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(view.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(view.slice(8, 12)), "WAVE");
  assert.equal(blob.type, "audio/wav");
  assert.equal(blob.size, 44 + 1600 * 2);
});
