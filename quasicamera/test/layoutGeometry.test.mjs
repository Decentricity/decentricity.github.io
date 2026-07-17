import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";

const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("manual controls use a unified landscape hardware plate at target widths", () => {
  const manual = cssBlock(".manual-controls");
  for (const variable of [
    "--control-gap",
    "--panel-radius",
    "--panel-padding",
    "--panel-border",
    "--panel-bg",
    "--panel-title-height",
    "--dial-size"
  ]) {
    assert.match(manual, new RegExp(`${escapeRegExp(variable)}:`));
  }

  assert.match(manual, /display:\s*grid/);
  assert.match(manual, /grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+minmax\(0,\s*0\.9fr\)\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(manual, /gap:\s*var\(--control-gap\)/);
  assert.match(manual, /padding:\s*var\(--control-gap\)/);
  assert.match(manual, /width:\s*100%/);

  const representativeWidths = [360, 390, 504, 768, 844, 915, 1024];
  const narrowBreakpoint = deliberateStackBreakpoint();
  for (const width of representativeWidths) {
    assert.ok(width > narrowBreakpoint, `${width}px should keep the landscape control plate`);
  }

  const mobileBlock = mediaBlock("390");
  assert.doesNotMatch(mobileBlock, /grid-template-columns:\s*1fr/);
});

test("panels share grid rows, titles, and base dimensions", () => {
  assert.match(cssBlock(".control-cluster,\n.mechanical-lever,\n.analog-dial"), /border:\s*var\(--panel-border\)/);
  assert.match(cssBlock(".control-cluster,\n.mechanical-lever,\n.analog-dial"), /border-radius:\s*var\(--panel-radius\)/);

  const title = cssBlock(".engraved-label");
  assert.match(title, /height:\s*var\(--panel-title-height\)/);
  assert.match(title, /line-height:\s*var\(--panel-title-height\)/);
  assert.match(title, /white-space:\s*nowrap/);

  assert.match(cssBlock(".mode-cluster"), /grid-column:\s*1/);
  assert.match(cssBlock(".mode-cluster"), /grid-row:\s*1/);
  assert.match(cssBlock(".lever-column"), /grid-column:\s*2/);
  assert.match(cssBlock(".lever-column"), /grid-row:\s*1/);
  assert.match(cssBlock(".lever-column"), /grid-template-rows:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);

  assert.match(cssBlock(".dial-row"), /display:\s*contents/);
  assert.match(cssBlock(".ev-dial"), /grid-column:\s*3/);
  assert.match(cssBlock(".ev-dial"), /grid-row:\s*1/);
  assert.match(cssBlock(".iso-dial"), /grid-column:\s*4/);
  assert.match(cssBlock(".iso-dial"), /grid-row:\s*1/);
});

test("dial pointers are contained inside their panels", () => {
  assert.doesNotMatch(css, /\.mode-pointer/);
  assert.match(cssBlock(".dial-index"), /top:\s*calc\(var\(--panel-padding\) \+ var\(--panel-title-height\) \+ 1px\)/);
});

test("EV and ISO dial marks use even radial geometry", () => {
  const evAngles = valuesFromMarkup("ev");
  assert.deepEqual(evAngles, [-120, -80, -40, 0, 40, 80, 120]);
  assert.deepEqual(intervals(evAngles), [40, 40, 40, 40, 40, 40]);

  const isoAngles = valuesFromMarkup("iso");
  assert.deepEqual(isoAngles, [-132, -108, -84, -60, -36, -12, 12, 36, 60, 84, 108, 132]);
  assert.deepEqual(intervals(isoAngles), [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24]);

  assert.match(cssBlock(".dial-face button"), /translateY\(var\(--label-radius\)\)/);
  assert.doesNotMatch(cssBlock(".dial-face"), /transform:\s*rotate/);
  assert.doesNotMatch(cssBlock(".dial-face button"), /--dial-angle|--rotor-angle/);
  assert.match(cssBlock(".dial-grip"), /transform:\s*rotate\(var\(--rotor-angle,\s*0deg\)\)/);
  assert.match(cssBlock(".iso-dial .dial-face button"), /--label-radius:\s*calc\(var\(--dial-size\) \* -0\.42\)/);
  assert.match(html, /class="dial-face dial-scale"/);
  assert.match(html, /class="dial-grip dial-rotor"/);
});

test("subject panel uses one cycling hardware button instead of a radial dial", () => {
  assert.match(html, /class="subject-cycle-button"/);
  assert.match(html, /data-control="subject-cycle"/);
  assert.equal([...html.matchAll(/data-control="subject-cycle"/g)].length, 1);
  assert.doesNotMatch(html, /mode-dial|mode-pointer|mode-hub|mode-choice|data-subject-mode|role="radiogroup" aria-label="Subject mode dial"/);
  assert.doesNotMatch(css, /\.mode-dial|\.mode-pointer|\.mode-hub|\.mode-choice|--mode-angle|--mode-choice-angle/);

  assert.match(cssBlock(".subject-cycle-button"), /display:\s*grid/);
  assert.match(cssBlock(".subject-cycle-button"), /border:\s*2px solid #171816/);
  assert.match(cssBlock(".subject-cycle-button"), /background:\s*#e9e0cf/);
  assert.match(cssBlock(".subject-cycle-button"), /color:\s*#10120f/);
  assert.match(cssBlock(".subject-icon svg,\n.mechanical-lever svg"), /opacity:\s*1/);
  assert.match(cssBlock(".subject-icon path,\n.subject-icon circle"), /fill:\s*currentColor/);
  assert.match(cssBlock(".subject-label"), /white-space:\s*nowrap/);
  assert.match(cssBlock(".subject-label"), /color:\s*#10120f/);
});

test("camera shell uses a small optical viewfinder and hidden debug panel", () => {
  const appShell = document.getElementById("app-shell");
  const cameraView = document.getElementById("camera-view");
  const filmView = document.getElementById("film-view");
  const viewfinder = document.getElementById("viewfinder");
  const cameraSwitch = document.getElementById("camera-switch");
  const debugPanel = document.getElementById("debug-panel");
  const latestFrame = document.getElementById("latest-frame");
  const instantReveal = document.getElementById("instant-reveal");

  assert.equal(appShell.dataset.view, "camera");
  assert.equal(cameraView.classList.contains("camera-view"), true);
  assert.equal(filmView.classList.contains("film-view"), true);
  assert.equal(filmView.getAttribute("aria-hidden"), "true");
  assert.equal(viewfinder.tagName, "BUTTON");
  assert.equal(viewfinder.classList.contains("optical-viewfinder"), true);
  assert.equal(viewfinder.getAttribute("aria-expanded"), "false");
  assert.equal(viewfinder.getAttribute("aria-controls"), "debug-panel");
  assert.equal(cameraSwitch.tagName, "BUTTON");
  assert.equal(cameraSwitch.classList.contains("camera-switch"), true);
  assert.equal(cameraSwitch.getAttribute("aria-label"), "Switch to front camera");
  assert.equal(cameraSwitch.getAttribute("aria-pressed"), "false");
  assert.equal(cameraSwitch.dataset.cameraFacing, "environment");
  assert.equal(debugPanel.hidden, true);
  assert.equal(debugPanel.classList.contains("hidden"), true);
  assert.equal(viewfinder.querySelector("#context-readout"), null);
  assert.equal(viewfinder.querySelector("#latest-frame"), null);
  assert.equal(viewfinder.querySelector("#developing"), null);
  assert.equal(instantReveal.contains(latestFrame), true);
  assert.doesNotMatch(css, /\.viewfinder\s*\{/);
  assert.match(cssBlock(".optical-viewfinder"), /width:\s*clamp\(82px,\s*12vw,\s*112px\)/);
  assert.match(cssBlock(".optical-viewfinder"), /max-width:\s*none/);
  assert.match(cssBlock(".optical-viewfinder"), /height:\s*clamp\(48px,\s*12vw,\s*70px\)/);
  assert.match(cssBlock(".camera-switch"), /width:\s*28px/);
  assert.match(cssBlock(".camera-switch"), /height:\s*34px/);
  assert.match(cssBlock(".camera-preview[data-camera-facing=\"user\"]"), /transform:\s*scaleX\(-1\)/);
  assert.match(css, /\.debug-panel\[hidden\]\s*\{[\s\S]*?display:\s*none/);
  assert.match(cssBlock(".debug-panel"), /position:\s*absolute/);
  assert.match(cssBlock(".queue-status"), /min-height:\s*28px/);
});

test("top plate keeps the optical viewfinder left and shutter right", () => {
  const topPlate = document.querySelector(".camera-top-plate");
  const children = [...topPlate.children];
  assert.equal(children[0].id, "viewfinder");
  assert.equal(children[1].id, "camera-switch");
  assert.equal(children.at(-1).id, "shutter");
  assert.ok(children.findIndex((child) => child.id === "fullscreen-button") < children.findIndex((child) => child.id === "shutter"));
  assert.match(cssBlock(".camera-top-plate"), /display:\s*grid/);
  assert.match(cssBlock(".camera-top-plate"), /grid-template-columns:\s*clamp\(88px,\s*13vw,\s*116px\)\s+30px/);
});

test("Camera and Film are full-viewport scenes with an isolated film scroller", () => {
  const appShell = cssBlock(".app-shell");
  const primary = cssBlock(".primary-view");
  const camera = cssBlock(".camera-view");
  const film = cssBlock(".film-view");

  assert.match(appShell, /position:\s*fixed/);
  assert.match(appShell, /width:\s*100dvw/);
  assert.match(appShell, /height:\s*100dvh/);
  assert.match(appShell, /overflow:\s*hidden/);
  assert.match(appShell, /--safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(appShell, /--switch-width:\s*40px/);
  assert.match(appShell, /--switch-height:\s*26px/);
  assert.match(primary, /position:\s*absolute/);
  assert.match(primary, /width:\s*100dvw/);
  assert.match(primary, /height:\s*100dvh/);
  assert.match(primary, /overflow:\s*hidden/);
  assert.match(primary, /var\(--switch-clearance\)/);
  assert.match(camera, /place-items:\s*center/);
  assert.match(film, /transform:\s*translateY\(100%\)/);
  assert.match(cssBlock('.app-shell[data-view="film"] .camera-view'), /transform:\s*translateY\(-100%\)/);
  assert.match(cssBlock('.app-shell[data-view="film"] .film-view'), /transform:\s*translateY\(0\)/);
  assert.match(cssBlock(".film-scroll"), /overflow-y:\s*auto/);
  assert.match(cssBlock(".film-scroll"), /overscroll-behavior:\s*contain/);
});

test("portrait layout no longer rotates the whole app", () => {
  const portrait = mediaOrientationBlock("portrait");
  assert.doesNotMatch(css, /app-orientation-shell|rotate\(90deg\)|width:\s*100vh|height:\s*100vw/);
  assert.match(portrait, /\.camera-stage\s*\{[\s\S]*?height:\s*100%/);
  assert.match(portrait, /\.manual-controls\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(portrait, /\.mode-cluster\s*\{[\s\S]*?grid-column:\s*1/);
  assert.match(portrait, /\.iso-dial\s*\{[\s\S]*?grid-column:\s*2/);
});

test("bottom view switch is persistent and camera-like", () => {
  const toggle = document.getElementById("view-toggle");
  assert.equal(toggle.tagName, "BUTTON");
  assert.equal(toggle.getAttribute("aria-label"), "Open film roll");
  assert.equal(toggle.getAttribute("aria-controls"), "film-view");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  assert.match(cssBlock(".view-toggle"), /position:\s*fixed/);
  assert.match(cssBlock(".view-toggle"), /bottom:\s*calc\(env\(safe-area-inset-bottom,\s*0px\) \+ 5px\)/);
  assert.match(cssBlock(".view-toggle"), /left:\s*50%/);
  assert.match(cssBlock(".view-toggle"), /z-index:\s*50/);
});

test("film view includes a full-view frame zoom and save control", () => {
  const zoom = document.getElementById("film-zoom");
  const image = document.getElementById("film-zoom-image");
  const time = document.getElementById("film-zoom-time");
  const close = document.getElementById("film-zoom-close");
  const save = document.getElementById("film-zoom-save");

  assert.equal(zoom.hidden, true);
  assert.equal(zoom.classList.contains("film-zoom"), true);
  assert.equal(image.tagName, "IMG");
  assert.equal(time.tagName, "TIME");
  assert.equal(close.tagName, "BUTTON");
  assert.equal(save.tagName, "BUTTON");
  assert.equal(save.textContent, "SAVE");
  assert.match(cssBlock(".film-zoom"), /position:\s*absolute/);
  assert.match(cssBlock(".film-zoom"), /z-index:\s*18/);
  assert.match(cssBlock(".film-zoom-card"), /background:\s*var\(--film-edge\)/);
  assert.match(cssBlock(".film-frame"), /cursor:\s*zoom-in/);
});

test("short landscape layout keeps controls compact and non-overlapping", () => {
  const landscape = mediaLandscapeShortBlock();
  assert.match(landscape, /\.app-shell\s*\{[\s\S]*?--switch-width:\s*34px/);
  assert.match(landscape, /\.app-shell\s*\{[\s\S]*?--switch-height:\s*22px/);
  assert.match(landscape, /\.film-door-panel\s*\{[\s\S]*?grid-template-rows:\s*auto auto auto/);
  assert.match(landscape, /\.manual-controls\s*\{[\s\S]*?--dial-size:\s*clamp\(56px,\s*8\.4vw,\s*72px\)/);
  assert.match(landscape, /\.indoor-toggle\s*\{[\s\S]*?width:\s*min\(42%,\s*330px\)/);
  assert.match(landscape, /\.indoor-toggle label\s*\{[\s\S]*?min-height:\s*22px/);
});

test("Indoor and Outdoor selector aligns with the manual control plate", () => {
  const indoor = cssBlock(".indoor-toggle");
  assert.match(indoor, /width:\s*100%/);
  assert.match(indoor, /margin:\s*0/);
  assert.match(indoor, /grid-template-columns:\s*1fr\s+1fr/);
});

function cssBlock(selector) {
  let start = -1;
  let from = 0;
  while (start === -1) {
    const candidate = css.indexOf(`${selector} {`, from);
    assert.notEqual(candidate, -1, `Missing CSS selector ${selector}`);
    const previous = css.slice(0, candidate).trimEnd().at(-1);
    if (previous !== ",") {
      start = candidate;
    } else {
      from = candidate + 1;
    }
  }
  assert.notEqual(start, -1, `Missing CSS selector ${selector}`);
  const open = css.indexOf("{", start);
  assert.notEqual(open, -1, `Missing CSS block for ${selector}`);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  assert.fail(`Unclosed CSS block for ${selector}`);
}

function mediaBlock(width) {
  const start = css.indexOf(`@media (max-width: ${width}px)`);
  assert.notEqual(start, -1, `Missing ${width}px media query`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  assert.fail(`Unclosed ${width}px media query`);
}

function mediaOrientationBlock(orientation) {
  const start = css.indexOf(`@media (orientation: ${orientation})`);
  assert.notEqual(start, -1, `Missing ${orientation} media query`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  assert.fail(`Unclosed ${orientation} media query`);
}

function mediaLandscapeShortBlock() {
  const start = css.indexOf("@media (orientation: landscape) and (max-height: 520px)");
  assert.notEqual(start, -1, "Missing short landscape media query");
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") {
      depth += 1;
    } else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  assert.fail("Unclosed short landscape media query");
}

function deliberateStackBreakpoint() {
  const block = mediaBlock("340");
  assert.match(block, /\.manual-controls\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  return 340;
}

function valuesFromMarkup(kind) {
  const attribute = kind === "ev" ? "data-ev" : "data-iso";
  return [...html.matchAll(new RegExp(`${attribute}="[^"]+" style="--tick-angle: (-?\\d+)deg"`, "g"))]
    .map((match) => Number(match[1]));
}

function intervals(values) {
  return values.slice(1).map((value, index) => value - values[index]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
