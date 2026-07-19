import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import {
  angleToNearestIndex,
  advanceDialDrag,
  beginDialDrag,
  pointerAngleDeg,
  shortestAngleDelta,
  valueIndexToAngle,
  valueToAngle
} from "../assets/ui/dialMath.js";
import { CONFIDENCE_DIAL, DOMAIN_DIAL, ManualControls } from "../assets/ui/manualControls.js";
import { DEFAULT_MANUAL_SETTINGS } from "../assets/context/manualSettings.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("pointer-angle convention is stable for semantic dials", () => {
  const rect = { left: 100, top: 50, width: 200, height: 200 };
  assert.equal(pointerAngleDeg(200, 50, rect), 0);
  assert.equal(pointerAngleDeg(300, 150, rect), 90);
  assert.equal(pointerAngleDeg(200, 250, rect), 180);
  assert.equal(pointerAngleDeg(100, 150, rect), 270);
});

test("shortest-angle delta handles 0/360 wraparound", () => {
  assert.equal(shortestAngleDelta(359, 1), 2);
  assert.equal(shortestAngleDelta(1, 359), -2);
});

test("domain and confidence detents map to their fixed dial arcs", () => {
  assert.equal(valueIndexToAngle(0, DOMAIN_DIAL.values.length, DOMAIN_DIAL.minAngle, DOMAIN_DIAL.maxAngle), DOMAIN_DIAL.minAngle);
  assert.equal(valueToAngle("nature", DOMAIN_DIAL.values, DOMAIN_DIAL.minAngle, DOMAIN_DIAL.maxAngle), -25);
  assert.equal(valueToAngle("food", DOMAIN_DIAL.values, DOMAIN_DIAL.minAngle, DOMAIN_DIAL.maxAngle), DOMAIN_DIAL.maxAngle);

  assert.equal(valueIndexToAngle(0, CONFIDENCE_DIAL.values.length, CONFIDENCE_DIAL.minAngle, CONFIDENCE_DIAL.maxAngle), CONFIDENCE_DIAL.minAngle);
  assert.equal(valueToAngle(0.5, CONFIDENCE_DIAL.values, CONFIDENCE_DIAL.minAngle, CONFIDENCE_DIAL.maxAngle), -40);
  assert.equal(valueToAngle(0.9, CONFIDENCE_DIAL.values, CONFIDENCE_DIAL.minAngle, CONFIDENCE_DIAL.maxAngle), CONFIDENCE_DIAL.maxAngle);
  assert.equal(angleToNearestIndex(-40, CONFIDENCE_DIAL.values.length, CONFIDENCE_DIAL.minAngle, CONFIDENCE_DIAL.maxAngle), 2);
});

test("relative dial dragging advances, retreats, wraps, and clamps without jumping", () => {
  let state = beginDialDrag(0, 359);
  let next = advanceDialDrag(state, 1, CONFIDENCE_DIAL);
  assert.equal(next.state.rawDialAngle, 2);

  state = beginDialDrag(0, 1);
  next = advanceDialDrag(state, 359, CONFIDENCE_DIAL);
  assert.equal(next.state.rawDialAngle, -2);

  state = beginDialDrag(CONFIDENCE_DIAL.maxAngle, 90);
  next = advanceDialDrag(state, 180, CONFIDENCE_DIAL);
  assert.equal(next.angle, CONFIDENCE_DIAL.maxAngle);
  assert.equal(next.value, 0.9);

  state = beginDialDrag(CONFIDENCE_DIAL.minAngle, 270);
  next = advanceDialDrag(state, 180, CONFIDENCE_DIAL);
  assert.equal(next.angle, CONFIDENCE_DIAL.minAngle);
  assert.equal(next.value, 0.3);
});

test("semantic controls render defaults and update every setting", () => {
  const { root, controls } = setupControls();

  assert.equal(root.querySelectorAll("[data-dial='domain']").length, 1);
  assert.equal(root.querySelectorAll("[data-dial='confidence']").length, 1);
  assert.equal(root.querySelectorAll("[data-control='analysis-mode-cycle']").length, 1);
  assert.equal(root.querySelector("[data-control='analysis-mode-cycle'] .analysis-label").textContent, "TAXONOMY");
  assert.equal(root.querySelector("[data-control='relations-visible']").dataset.selected, "on");
  assert.equal(root.querySelector("[data-control='boxes-visible']").dataset.selected, "on");
  assert.equal(root.querySelector("[data-control='overlay-density']").dataset.selected, "normal");
  assert.equal(root.querySelector("[data-control='scan-mode']").dataset.selected, "balanced");
  assert.equal(root.querySelector("[data-control='view-mode']").dataset.selected, "live");

  click(root.querySelector("[data-domain='tech']"));
  click(root.querySelector("[data-overlay-density='full']"));
  click(root.querySelector("[data-control='analysis-mode-cycle']"));
  click(root.querySelector("[data-relations-visible='false']"));
  click(root.querySelector("[data-boxes-visible='false']"));
  click(root.querySelector("[data-confidence='80']"));
  click(root.querySelector("[data-scan-mode='survey']"));
  click(root.querySelector("[data-view-mode='freeze']"));

  assert.deepEqual(controls.currentSettings(), {
    domain: "tech",
    overlayDensity: "full",
    analysisMode: "semantic",
    relationsVisible: false,
    boxesVisible: false,
    confidenceThreshold: 0.8,
    scanMode: "survey",
    viewMode: "freeze"
  });
  assert.equal(root.querySelector("[data-dial='domain']").style.getPropertyValue("--rotor-angle"), "25deg");
  assert.equal(root.querySelector("[data-dial='confidence']").style.getPropertyValue("--rotor-angle"), "80deg");
});

test("analysis mode button cycles with keyboard and persists", () => {
  const storage = fakeStorage({
    "concamera.overlaySettings.v1": JSON.stringify({
      ...DEFAULT_MANUAL_SETTINGS,
      analysisMode: "risk"
    })
  });
  const { root, controls } = setupControls(storage);
  const button = root.querySelector("[data-control='analysis-mode-cycle']");
  assert.equal(root.querySelector(".analysis-label").textContent, "RISK");

  key(button, "Enter");
  assert.equal(controls.currentSettings().analysisMode, "attention");
  assert.equal(root.querySelector(".analysis-label").textContent, "ATTENTION");

  key(button, " ");
  assert.equal(controls.currentSettings().analysisMode, "taxonomy");

  key(button, "ArrowLeft");
  assert.equal(controls.currentSettings().analysisMode, "attention");

  const saved = JSON.parse(storage.getItem("concamera.overlaySettings.v1"));
  assert.equal(saved.analysisMode, "attention");
});

test("selector keyboard operation and freeze copies work", () => {
  const { root, controls } = setupControls();
  const overlay = root.querySelector("[data-overlay-density='normal']");
  const scan = root.querySelector("[data-scan-mode='balanced']");
  const view = root.querySelector("[data-view-mode='live']");
  const confidenceDial = root.querySelector("[data-dial='confidence']");

  key(overlay, "ArrowLeft");
  assert.equal(controls.currentSettings().overlayDensity, "minimal");
  key(scan, "End");
  assert.equal(controls.currentSettings().scanMode, "survey");
  key(view, " ");
  assert.equal(controls.currentSettings().viewMode, "freeze");
  key(confidenceDial, "End");
  assert.equal(controls.currentSettings().confidenceThreshold, 0.9);

  const frozen = controls.freezeSettings();
  click(root.querySelector("[data-confidence='30']"));
  assert.equal(frozen.confidenceThreshold, 0.9);
  assert.equal(controls.currentSettings().confidenceThreshold, 0.3);
});

test("generation-era controls are absent from the ConCamera DOM", () => {
  const { document } = parseHTML(html);
  assert.equal(document.querySelector("[data-ev]"), null);
  assert.equal(document.querySelector("[data-iso]"), null);
  assert.equal(document.querySelector("[data-flash-mode]"), null);
  assert.equal(document.querySelector("[data-focus-style]"), null);
  assert.equal(document.querySelector("[data-grounding-mode]"), null);
  assert.equal(document.querySelector("[data-control='subject-cycle']"), null);
});

function setupControls(storage = fakeStorage()) {
  const { document, window } = parseHTML(html);
  globalThis.window = window;
  globalThis.document = document;
  globalThis.localStorage = storage;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement;
  globalThis.Element = window.Element;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.Event = window.Event;

  const root = document.getElementById("manual-controls");
  const controls = new ManualControls(root);
  return { root, controls, storage };
}

function click(element) {
  element.dispatchEvent(new globalThis.Event("click", { bubbles: true }));
}

function key(element, keyName) {
  const event = new globalThis.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: keyName });
  element.dispatchEvent(event);
}

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(keyName) {
      return values.has(keyName) ? values.get(keyName) : null;
    },
    setItem(keyName, value) {
      values.set(keyName, String(value));
    }
  };
}
