import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { Gallery, errorNumberFor } from "../assets/gallery/gallery.js";

test("errorNumberFor extracts visible HTTP-style error numbers", () => {
  assert.equal(errorNumberFor("local model request failed: 429 resource busy"), "429");
  assert.equal(errorNumberFor("object analysis failed with HTTP 504: asset timeout"), "504");
  assert.equal(errorNumberFor("overlay renderer failed: 500 canvas unavailable"), "500");
  assert.equal(errorNumberFor("object analysis timed out"), "408");
  assert.equal(errorNumberFor("Source photo released; take a new exposure"), "410");
  assert.equal(errorNumberFor("provider exploded"), "000");
});

test("failed film frame displays exact error number when available", () => {
  const harness = galleryHarness();
  harness.gallery.addPlaceholder({
    id: "job-429",
    timestamp: "2026-07-17T03:03:00.000Z",
    status: "queued"
  });

  harness.gallery.failPlaceholder("job-429", "local model request failed: 429 resource busy");

  const button = harness.document.querySelector("[data-retry-job='job-429']");
  assert.ok(button);
  assert.equal(button.textContent, "EXPOSURE FAILED\nERROR 429\nTAP TO RETRY");
  assert.equal(button.getAttribute("aria-label"), "Exposure failed with error 429. Tap to retry.");
});

test("failed film frame shows a local numeric code when no provider status exists", () => {
  const harness = galleryHarness();
  harness.gallery.addPlaceholder({
    id: "job-no-code",
    timestamp: "2026-07-17T03:03:00.000Z",
    status: "queued"
  });

  harness.gallery.failPlaceholder("job-no-code", "provider exploded");

  const button = harness.document.querySelector("[data-retry-job='job-no-code']");
  assert.ok(button);
  assert.equal(button.textContent, "EXPOSURE FAILED\nERROR 000\nTAP TO RETRY");
  assert.equal(button.getAttribute("aria-label"), "Exposure failed with error 000. Tap to retry.");
});

test("failed film frame maps timeout failures to 408", () => {
  const harness = galleryHarness();
  harness.gallery.addPlaceholder({
    id: "job-timeout",
    timestamp: "2026-07-17T03:03:00.000Z",
    status: "queued"
  });

  harness.gallery.failPlaceholder("job-timeout", "object analysis timed out");

  const button = harness.document.querySelector("[data-retry-job='job-timeout']");
  assert.ok(button);
  assert.equal(button.textContent, "EXPOSURE FAILED\nERROR 408\nTAP TO RETRY");
  assert.equal(button.getAttribute("aria-label"), "Exposure failed with error 408. Tap to retry.");
});

function galleryHarness() {
  const { document, window } = parseHTML(`
    <ol id="film-strip"></ol>
    <button id="export-json"></button>
    <div id="film-zoom" hidden></div>
    <img id="film-zoom-image">
    <time id="film-zoom-time"></time>
    <button id="film-zoom-close"></button>
    <button id="film-zoom-save"></button>
  `);
  globalThis.document = document;
  globalThis.window = window;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;

  const storage = {
    async loadFrames() {
      return [];
    },
    async saveFrame() {},
    exportMetadata() {
      return new Blob(["[]"], { type: "application/json" });
    }
  };

  return {
    document,
    gallery: new Gallery(
      document.getElementById("film-strip"),
      document.getElementById("export-json"),
      storage,
      document.getElementById("film-zoom"),
      document.getElementById("film-zoom-image"),
      document.getElementById("film-zoom-time"),
      document.getElementById("film-zoom-close"),
      document.getElementById("film-zoom-save")
    )
  };
}
