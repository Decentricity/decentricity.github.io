import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const { document } = parseHTML(html);

test("manifest is installable under the GitHub Pages subdirectory", async () => {
  assert.equal(manifest.name, "QuasiCamera");
  assert.equal(manifest.short_name, "QuasiCam");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "landscape");
  assert.equal(manifest.background_color, "#11110f");
  assert.equal(manifest.theme_color, "#3d403c");
  assert.deepEqual(
    manifest.icons.map((icon) => icon.src),
    ["./icons/icon-192.svg", "./icons/icon-512.svg"]
  );
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && /maskable/.test(icon.purpose)));

  await access(new URL("../icons/icon-192.svg", import.meta.url));
  await access(new URL("../icons/icon-512.svg", import.meta.url));
});

test("page exposes PWA metadata and a discreet fullscreen control", () => {
  assert.equal(document.querySelector("link[rel='manifest']").getAttribute("href"), "./manifest.webmanifest");
  assert.equal(document.querySelector("meta[name='theme-color']").getAttribute("content"), "#2f312f");
  const fullscreen = document.getElementById("fullscreen-button");
  assert.equal(fullscreen.tagName, "BUTTON");
  assert.equal(fullscreen.getAttribute("aria-label"), "Enter fullscreen");
  assert.equal(fullscreen.getAttribute("aria-pressed"), "false");
});

test("service worker caches only same-origin static app shell files", () => {
  assert.match(sw, /quasi-camera-static-v3/);
  assert.match(sw, /\.\/index\.html/);
  assert.match(sw, /\.\/styles\.css/);
  assert.doesNotMatch(sw, /["']\.\/sw\.js["']/);
  assert.match(sw, /\.\/manifest\.webmanifest/);
  assert.match(sw, /\.\/icons\/icon-192\.svg/);
  assert.match(sw, /\.\/icons\/icon-512\.svg/);
  assert.match(sw, /\.\/assets\/main\.js/);
  assert.match(sw, /\.\/assets\/camera\/liveCamera\.js/);
  assert.match(sw, /\.\/assets\/capture\/captureQueue\.js/);
  assert.match(sw, /\.\/assets\/faces\/faceAnalyzer\.js/);
  assert.match(sw, /\.\/assets\/faces\/faceSelection\.js/);
  assert.match(sw, /\.\/assets\/faces\/faceCrops\.js/);
  assert.match(sw, /\.\/assets\/objects\/objectAnalyzer\.js/);
  assert.match(sw, /\.\/assets\/objects\/objectNormalization\.js/);
  assert.match(sw, /\.\/assets\/gallery\/filmExport\.js/);
  assert.match(sw, /key\.startsWith\("quasi-camera-static-"\)/);
  assert.match(sw, /request\.method !== "GET"/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /STATIC_PATHS\.has\(url\.pathname\)/);
  assert.match(sw, /fetch\(request,\s*\{\s*cache:\s*"no-cache"\s*\}\)/);
  assert.match(sw, /request\.mode === "navigate"/);
  assert.doesNotMatch(sw, /api\.openai\.com|nominatim|bigdatacloud|Authorization|sk-/i);
});
