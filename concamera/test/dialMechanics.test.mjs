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
import { DEFAULT_MANUAL_SETTINGS } from "../assets/context/manualSettings.js";
import { EV_DIAL, ISO_DIAL, ManualControls } from "../assets/ui/manualControls.js";

test("pointer angle convention uses top as zero and clockwise positive", () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  assert.equal(Math.round(pointerAngleDeg(50, 0, rect)), 0);
  assert.equal(Math.round(pointerAngleDeg(100, 50, rect)), 90);
  assert.equal(Math.round(pointerAngleDeg(50, 100, rect)), 180);
  assert.equal(Math.round(pointerAngleDeg(0, 50, rect)), 270);
});

test("shortest-angle delta handles wraparound", () => {
  assert.equal(shortestAngleDelta(359, 1), 2);
  assert.equal(shortestAngleDelta(1, 359), -2);
});

test("EV and ISO detents map to documented dial arcs", () => {
  assert.equal(valueIndexToAngle(0, EV_DIAL.values.length, EV_DIAL.minAngle, EV_DIAL.maxAngle), EV_DIAL.minAngle);
  assert.equal(valueIndexToAngle(3, EV_DIAL.values.length, EV_DIAL.minAngle, EV_DIAL.maxAngle), 0);
  assert.equal(valueIndexToAngle(6, EV_DIAL.values.length, EV_DIAL.minAngle, EV_DIAL.maxAngle), EV_DIAL.maxAngle);

  assert.equal(valueToAngle(80, ISO_DIAL.values, ISO_DIAL.minAngle, ISO_DIAL.maxAngle), ISO_DIAL.minAngle);
  assert.equal(valueToAngle(200, ISO_DIAL.values, ISO_DIAL.minAngle, ISO_DIAL.maxAngle), -36);
  assert.equal(valueToAngle(1000, ISO_DIAL.values, ISO_DIAL.minAngle, ISO_DIAL.maxAngle), ISO_DIAL.maxAngle);
  assert.equal(angleToNearestIndex(-36, ISO_DIAL.values.length, ISO_DIAL.minAngle, ISO_DIAL.maxAngle), 4);
});

test("relative drag model advances, retreats, wraps, and clamps predictably", () => {
  let state = beginDialDrag(0, 0);
  let next = advanceDialDrag(state, 45, EV_DIAL);
  assert.equal(next.value, 1);

  state = beginDialDrag(0, 0);
  next = advanceDialDrag(state, 315, EV_DIAL);
  assert.equal(next.value, -1);

  state = beginDialDrag(0, 359);
  next = advanceDialDrag(state, 1, EV_DIAL);
  assert.equal(next.value, 0);

  state = beginDialDrag(120, 120);
  next = advanceDialDrag(state, 180, EV_DIAL);
  assert.equal(next.value, 3);
  assert.equal(next.angle, 120);
});

test("ManualControls leaves labels stationary and only rotates the rotor", async () => {
  const { window, root } = await setupManualControlsDom();
  const controls = new ManualControls(root);
  const evDial = root.querySelector("[data-dial='ev']");
  const evFace = evDial.querySelector("[data-dial-face]");
  const evRotor = evDial.querySelector(".dial-rotor");
  const plusThree = evDial.querySelector("[data-ev='3']");
  const initialLabelStyle = plusThree.getAttribute("style");

  assert.equal(evFace.style.getPropertyValue("--dial-angle"), "");
  assert.equal(evRotor.style.getPropertyValue("--rotor-angle"), "");
  assert.equal(evDial.style.getPropertyValue("--rotor-angle"), "0deg");

  plusThree.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(controls.currentSettings().exposureCompensationEv, 3);
  assert.equal(evDial.style.getPropertyValue("--rotor-angle"), "120deg");
  assert.equal(plusThree.getAttribute("style"), initialLabelStyle);
});

test("ManualControls pointer and keyboard interactions use hard detents", async () => {
  const { window, root } = await setupManualControlsDom();
  const controls = new ManualControls(root);
  const evDial = root.querySelector("[data-dial='ev']");
  const evFace = evDial.querySelector("[data-dial-face]");
  const isoDial = root.querySelector("[data-dial='iso']");
  const isoFace = isoDial.querySelector("[data-dial-face]");
  let changes = 0;
  controls.onChange(() => {
    changes += 1;
  });

  setDialRect(evFace);
  setDialRect(isoFace);

  drag(window, evFace, 0, 0);
  assert.equal(controls.currentSettings().exposureCompensationEv, 0);
  assert.equal(changes, 0);

  drag(window, evFace, 0, 45);
  assert.equal(controls.currentSettings().exposureCompensationEv, 1);

  drag(window, evFace, 0, -45);
  assert.equal(controls.currentSettings().exposureCompensationEv, 0);

  drag(window, evFace, -1, 1);
  assert.equal(controls.currentSettings().exposureCompensationEv, 0);

  root.querySelector("[data-ev='3']").dispatchEvent(new window.Event("click", { bubbles: true }));
  drag(window, evFace, 120, 180);
  assert.equal(controls.currentSettings().exposureCompensationEv, 3);

  drag(window, isoFace, -36, -60);
  assert.equal(controls.currentSettings().iso, 160);

  const beforeRepeated = changes;
  root.querySelector("[data-ev='0']").dispatchEvent(new window.Event("click", { bubbles: true }));
  drag(window, evFace, 0, 45);
  drag(window, evFace, 40, 80);
  assert.equal(controls.currentSettings().exposureCompensationEv, 2);
  assert.equal(changes, beforeRepeated + 3);

  key(window, evDial, "ArrowLeft");
  assert.equal(controls.currentSettings().exposureCompensationEv, 1);
  key(window, evDial, "Home");
  assert.equal(controls.currentSettings().exposureCompensationEv, -3);
  key(window, evDial, "End");
  assert.equal(controls.currentSettings().exposureCompensationEv, 3);
});

test("saved settings reload at the correct rotor angle", async () => {
  const { root, storage } = await setupManualControlsDom();
  storage.setItem("concamera.manualSettings.v1", JSON.stringify({
    ...DEFAULT_MANUAL_SETTINGS,
    exposureCompensationEv: -2,
    iso: 640
  }));

  new ManualControls(root);
  assert.equal(root.querySelector("[data-dial='ev']").style.getPropertyValue("--rotor-angle"), "-80deg");
  assert.equal(root.querySelector("[data-dial='iso']").style.getPropertyValue("--rotor-angle"), "84deg");
});

test("subject cycle button advances through the four internal modes", async () => {
  const { window, root } = await setupManualControlsDom();
  const controls = new ManualControls(root);
  const button = root.querySelector("[data-control='subject-cycle']");

  assert.equal(root.querySelectorAll("[data-control='subject-cycle']").length, 1);
  assert.equal(root.querySelector(".subject-label").textContent, "LANDSCAPE");
  assert.equal(visibleSubjectIcon(root), "landscape");

  button.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(controls.currentSettings().subjectMode, "single-person");
  assert.equal(root.querySelector(".subject-label").textContent, "PERSON");
  assert.equal(visibleSubjectIcon(root), "single-person");

  button.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(controls.currentSettings().subjectMode, "group");
  assert.equal(root.querySelector(".subject-label").textContent, "GROUP");

  button.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(controls.currentSettings().subjectMode, "crowd");
  assert.equal(root.querySelector(".subject-label").textContent, "CROWD");

  button.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(controls.currentSettings().subjectMode, "landscape");
  assert.equal(root.querySelector(".subject-label").textContent, "LANDSCAPE");
});

test("subject cycle button supports keyboard activation and persisted modes", async () => {
  const { window, root, storage } = await setupManualControlsDom();
  storage.setItem("concamera.manualSettings.v1", JSON.stringify({
    ...DEFAULT_MANUAL_SETTINGS,
    subjectMode: "crowd"
  }));

  const controls = new ManualControls(root);
  const button = root.querySelector("[data-control='subject-cycle']");
  assert.equal(root.querySelector(".subject-label").textContent, "CROWD");
  assert.equal(button.getAttribute("aria-label"), "Subject mode: CROWD. Press to change mode.");

  key(window, button, "Enter");
  assert.equal(controls.currentSettings().subjectMode, "landscape");
  assert.equal(root.querySelector(".subject-label").textContent, "LANDSCAPE");

  key(window, button, " ");
  assert.equal(controls.currentSettings().subjectMode, "single-person");
  assert.equal(root.querySelector(".subject-label").textContent, "PERSON");

  key(window, button, "ArrowLeft");
  assert.equal(controls.currentSettings().subjectMode, "landscape");
  assert.equal(root.querySelector(".subject-label").textContent, "LANDSCAPE");
});

test("subject mode freezes at shutter time from the cycle button", async () => {
  const { window, root } = await setupManualControlsDom();
  const controls = new ManualControls(root);
  const button = root.querySelector("[data-control='subject-cycle']");

  button.dispatchEvent(new window.Event("click", { bubbles: true }));
  const frozen = controls.freezeSettings();
  button.dispatchEvent(new window.Event("click", { bubbles: true }));

  assert.equal(frozen.subjectMode, "single-person");
  assert.equal(controls.currentSettings().subjectMode, "group");
});

test("focal distance strip supports click, keyboard, persistence, and freezing", async () => {
  const { window, root, storage } = await setupManualControlsDom();
  storage.setItem("concamera.manualSettings.v1", JSON.stringify({
    ...DEFAULT_MANUAL_SETTINGS,
    focalDistance: "35mm"
  }));

  const controls = new ManualControls(root);
  const focalPanel = root.querySelector("[data-control='focal-distance']");
  const fifty = root.querySelector("[data-focal-distance='50mm']");
  const macro = root.querySelector("[data-focal-distance='macro']");

  assert.equal(focalPanel.dataset.selected, "35mm");
  assert.equal(focalPanel.style.getPropertyValue("--focal-index"), "2");
  assert.equal(root.querySelector("[data-focal-distance='35mm']").classList.contains("is-selected"), true);

  fifty.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(controls.currentSettings().focalDistance, "50mm");
  assert.equal(focalPanel.style.getPropertyValue("--focal-index"), "3");
  assert.equal(fifty.getAttribute("aria-checked"), "true");

  key(window, fifty, "ArrowRight");
  assert.equal(controls.currentSettings().focalDistance, "80mm");
  key(window, fifty, "ArrowLeft");
  assert.equal(controls.currentSettings().focalDistance, "50mm");
  key(window, fifty, "Home");
  assert.equal(controls.currentSettings().focalDistance, "21mm");
  key(window, fifty, "End");
  assert.equal(controls.currentSettings().focalDistance, "macro");
  assert.equal(macro.classList.contains("is-selected"), true);

  const frozen = controls.freezeSettings();
  root.querySelector("[data-focal-distance='21mm']").dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(frozen.focalDistance, "macro");
  assert.equal(controls.currentSettings().focalDistance, "21mm");
});

test("grounding switch supports click, keyboard, persistence, and freezing", async () => {
  const { window, root, storage } = await setupManualControlsDom();
  storage.setItem("concamera.manualSettings.v1", JSON.stringify({
    ...DEFAULT_MANUAL_SETTINGS,
    groundingMode: "free"
  }));

  const controls = new ManualControls(root);
  const groundingPanel = root.querySelector("[data-control='grounding']");
  const grounded = root.querySelector("[data-grounding-mode='grounded']");
  const free = root.querySelector("[data-grounding-mode='free']");

  assert.equal(groundingPanel.dataset.selected, "free");
  assert.equal(free.classList.contains("is-selected"), true);
  assert.equal(free.getAttribute("aria-checked"), "true");

  grounded.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(controls.currentSettings().groundingMode, "grounded");
  assert.equal(groundingPanel.dataset.selected, "grounded");
  assert.equal(grounded.getAttribute("aria-checked"), "true");

  key(window, grounded, "ArrowRight");
  assert.equal(controls.currentSettings().groundingMode, "free");
  key(window, free, "ArrowLeft");
  assert.equal(controls.currentSettings().groundingMode, "grounded");
  key(window, grounded, "End");
  assert.equal(controls.currentSettings().groundingMode, "free");
  key(window, free, "Home");
  assert.equal(controls.currentSettings().groundingMode, "grounded");
  key(window, grounded, " ");
  assert.equal(controls.currentSettings().groundingMode, "free");

  const frozen = controls.freezeSettings();
  grounded.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(frozen.groundingMode, "free");
  assert.equal(controls.currentSettings().groundingMode, "grounded");
});

test("old radial subject dial elements are absent from the DOM", async () => {
  const { root } = await setupManualControlsDom();
  new ManualControls(root);

  assert.equal(root.querySelectorAll(".subject-cycle-button").length, 1);
  assert.equal(root.querySelectorAll(".mode-dial").length, 0);
  assert.equal(root.querySelectorAll(".mode-pointer").length, 0);
  assert.equal(root.querySelectorAll(".mode-hub").length, 0);
  assert.equal(root.querySelectorAll(".mode-choice").length, 0);
  assert.equal(root.querySelectorAll("[data-subject-mode]").length, 0);
  assert.equal(root.querySelector("[data-control='subject-cycle'] .subject-label").textContent.length > 0, true);
});

async function setupManualControlsDom() {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const { window, document } = parseHTML(html);
  const storage = fakeStorage();
  globalThis.window = window;
  globalThis.document = document;
  globalThis.localStorage = storage;
  globalThis.Element = window.Element;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.HTMLButtonElement = window.HTMLButtonElement;

  window.HTMLElement.prototype.setPointerCapture = function setPointerCapture(pointerId) {
    this.__capturedPointer = pointerId;
  };
  window.HTMLElement.prototype.releasePointerCapture = function releasePointerCapture() {
    this.__capturedPointer = undefined;
  };
  window.HTMLElement.prototype.hasPointerCapture = function hasPointerCapture(pointerId) {
    return this.__capturedPointer === pointerId;
  };

  return {
    window,
    root: document.getElementById("manual-controls"),
    storage
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

function setDialRect(element) {
  element.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100,
    right: 100,
    bottom: 100
  });
}

function drag(window, face, fromAngle, toAngle) {
  const pointerId = Math.floor(Math.random() * 1000) + 1;
  face.dispatchEvent(pointerEvent(window, "pointerdown", fromAngle, pointerId));
  face.dispatchEvent(pointerEvent(window, "pointermove", toAngle, pointerId));
  face.dispatchEvent(pointerEvent(window, "pointerup", toAngle, pointerId));
}

function pointerEvent(window, type, angle, pointerId) {
  const point = pointForAngle(angle);
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: point.x },
    clientY: { value: point.y },
    pointerId: { value: pointerId }
  });
  return event;
}

function pointForAngle(angleDeg) {
  const radians = angleDeg * Math.PI / 180;
  return {
    x: 50 + Math.sin(radians) * 45,
    y: 50 - Math.cos(radians) * 45
  };
}

function key(window, element, keyValue) {
  const event = new window.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { value: keyValue });
  element.dispatchEvent(event);
}

function visibleSubjectIcon(root) {
  const visible = [...root.querySelectorAll("[data-subject-icon]")].find((icon) => !icon.hidden);
  return visible?.getAttribute("data-subject-icon") ?? null;
}
