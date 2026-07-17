import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import { Gallery, errorNumberFor } from "../assets/gallery/gallery.js";

test("errorNumberFor extracts visible HTTP-style error numbers", () => {
  assert.equal(errorNumberFor("OpenAI image edit request failed: 429 rate limit"), "429");
  assert.equal(errorNumberFor("Object analysis provider failed with HTTP 504: gateway timeout"), "504");
  assert.equal(errorNumberFor("image endpoint failed: 500 server busy"), "500");
  assert.equal(errorNumberFor("Source photo released; take a new exposure"), null);
});

test("failed film frame displays exact error number when available", () => {
  const harness = galleryHarness();
  harness.gallery.addPlaceholder({
    id: "job-429",
    timestamp: "2026-07-17T03:03:00.000Z",
    status: "queued"
  });

  harness.gallery.failPlaceholder("job-429", "OpenAI image edit request failed: 429 rate limit");

  const button = harness.document.querySelector("[data-retry-job='job-429']");
  assert.ok(button);
  assert.equal(button.textContent, "EXPOSURE FAILED\nERROR 429\nTAP TO RETRY");
  assert.equal(button.getAttribute("aria-label"), "Exposure failed with error 429. Tap to retry.");
});

test("failed film frame omits error number when no numeric code exists", () => {
  const harness = galleryHarness();
  harness.gallery.addPlaceholder({
    id: "job-no-code",
    timestamp: "2026-07-17T03:03:00.000Z",
    status: "queued"
  });

  harness.gallery.failPlaceholder("job-no-code", "Source photo released; take a new exposure");

  const button = harness.document.querySelector("[data-retry-job='job-no-code']");
  assert.ok(button);
  assert.equal(button.textContent, "EXPOSURE FAILED\nTAP TO RETRY");
  assert.equal(button.getAttribute("aria-label"), "Exposure failed. Tap to retry.");
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
