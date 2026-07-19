import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("ConCamera keeps the two-view camera and film architecture", () => {
  assert.equal(document.getElementById("app-shell").dataset.view, "camera");
  assert.ok(document.getElementById("camera-view"));
  assert.ok(document.getElementById("film-view"));
  assert.equal(document.getElementById("film-view").getAttribute("aria-hidden"), "true");
  assert.equal(document.getElementById("view-toggle").getAttribute("aria-label"), "Open film roll");
  assert.match(cssBlock(".primary-view"), /position:\s*absolute/);
  assert.match(cssBlock('.app-shell[data-view="film"] .camera-view'), /translateY\(-100%\)/);
  assert.match(cssBlock(".film-scroll"), /overflow-y:\s*auto/);
});

test("semantic control plate replaces photographic generation controls", () => {
  assert.equal(document.querySelectorAll("[data-domain]").length, 6);
  assert.deepEqual(
    [...document.querySelectorAll("[data-domain]")].map((button) => button.getAttribute("data-domain")),
    ["general", "urban", "nature", "tech", "vehicle", "food"]
  );
  assert.equal(document.querySelectorAll("[data-overlay-density]").length, 3);
  assert.equal(document.querySelectorAll("[data-control='analysis-mode-cycle']").length, 1);
  assert.equal(document.querySelectorAll("[data-relations-visible]").length, 2);
  assert.equal(document.querySelectorAll("[data-boxes-visible]").length, 2);
  assert.equal(document.querySelectorAll("[data-confidence]").length, 7);
  assert.equal(document.querySelectorAll("[data-scan-mode]").length, 3);
  assert.equal(document.querySelectorAll("[data-view-mode]").length, 2);

  assert.equal(document.querySelector("[data-ev]"), null);
  assert.equal(document.querySelector("[data-iso]"), null);
  assert.equal(document.querySelector("[data-flash-mode]"), null);
  assert.equal(document.querySelector("[data-focus-style]"), null);
  assert.equal(document.querySelector("[data-grounding-mode]"), null);
  assert.equal(document.querySelector("#openai-key"), null);
});

test("semantic controls retain analog hardware layout and compact labels", () => {
  assert.match(cssBlock(".manual-controls"), /display:\s*grid/);
  assert.match(cssBlock(".semantic-controls"), /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(cssBlock(".lens-dial"), /grid-column:\s*1/);
  assert.match(cssBlock(".analysis-control-panel"), /grid-column:\s*2/);
  assert.match(cssBlock(".semantic-stack"), /grid-column:\s*3/);
  assert.match(cssBlock(".confidence-dial"), /grid-column:\s*4/);
  assert.match(cssBlock(".scan-panel"), /grid-column:\s*1\s*\/\s*3/);
  assert.match(cssBlock(".view-panel"), /grid-column:\s*3\s*\/\s*5/);
  assert.match(cssBlock(".analysis-cycle-button"), /border:\s*2px solid #171816/);
  assert.match(css, /\.analysis-icon svg,\s*\n\.analysis-icon path,\s*\n\.analysis-icon circle\s*\{[\s\S]*?fill:\s*currentColor/);
  assert.match(cssBlock(".analysis-label"), /white-space:\s*nowrap/);
});

test("lens and confidence scales are stationary while only the rotor is transformed", () => {
  assert.match(cssBlock(".dial-face button"), /transform:\s*rotate\(var\(--tick-angle\)\)\s+translateY/);
  assert.match(cssBlock(".dial-grip"), /transform:\s*rotate\(var\(--rotor-angle,\s*0deg\)\)/);
  assert.doesNotMatch(cssBlock(".dial-face"), /rotate\(var\(--rotor-angle/);
});

test("viewfinder and shutter retain the physical camera positions", () => {
  const topPlateChildren = [...document.querySelector(".camera-top-plate").children].map((element) => element.id || element.className);
  assert.equal(topPlateChildren.indexOf("viewfinder") < topPlateChildren.indexOf("shutter"), true);
  assert.match(cssBlock(".optical-viewfinder"), /width:\s*clamp/);
  assert.match(cssBlock(".camera-top-plate"), /display:\s*grid/);
  assert.match(cssBlock(".camera-top-plate"), /grid-template-columns:\s*clamp/);
  assert.match(cssBlock(".shutter"), /border-radius:\s*50%/);
  assert.match(cssBlock(".view-toggle"), /position:\s*fixed/);
  assert.doesNotMatch(css, /rotate\(90deg\)|width:\s*100vh|height:\s*100vw/);
});

test("placeholder and film labels describe local analysis instead of generation", () => {
  assert.match(html, /READY/);
  assert.doesNotMatch(html, /DEVELOPING/);
  assert.match(css, /film-frame-pending/);
  assert.match(css, /film-placeholder/);
});

function cssBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\}`, "m"));
  assert.ok(match, `Missing CSS block for ${selector}`);
  return match[0];
}
