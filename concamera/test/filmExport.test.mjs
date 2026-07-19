import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFilmDownloadFilename, composeFilmFramePng } from "../assets/gallery/filmExport.js";

test("film export composes image, border, and timestamp into one PNG blob", async () => {
  const calls = [];
  const frame = frameFixture();
  const blob = await composeFilmFramePng(frame, {
    async loadImage(src) {
      calls.push(["loadImage", src]);
      return {
        width: 1200,
        height: 900
      };
    },
    createCanvas(width, height) {
      calls.push(["createCanvas", width, height]);
      return {
        width,
        height,
        getContext() {
          return {
            fillStyle: "",
            font: "",
            textBaseline: "",
            textAlign: "",
            fillRect: (...args) => calls.push(["fillRect", ...args]),
            drawImage: (...args) => calls.push(["drawImage", ...args]),
            fillText: (...args) => calls.push(["fillText", ...args])
          };
        }
      };
    },
    async canvasToBlob(canvas) {
      calls.push(["canvasToBlob", canvas.width, canvas.height]);
      return new Blob(["png"], { type: "image/png" });
    }
  });

  assert.equal(blob.type, "image/png");
  assert.deepEqual(calls[0], ["createCanvas", 1400, 1560]);
  assert.deepEqual(calls[1], ["loadImage", frame.imageDataUrl]);
  assert.ok(calls.some((call) => call[0] === "fillRect" && call[1] === 0 && call[2] === 0));
  assert.ok(calls.some((call) => call[0] === "drawImage"));
  assert.ok(calls.some((call) => call[0] === "fillText" && /Jul/.test(call[1])));
  assert.ok(calls.some((call) => call[0] === "canvasToBlob" && call[1] === 1400 && call[2] === 1560));
});

test("film export filename is stable and filesystem-safe", () => {
  assert.equal(
    buildFilmDownloadFilename(frameFixture()),
    "con-camera-frame-2026-07-17T05-15-30-000Z.png"
  );
});

function frameFixture() {
  return {
    id: "frame-1",
    timestamp: "2026-07-17T05:15:30.000Z",
    imageDataUrl: "data:image/png;base64,abc",
    provider: "mock",
    prompt: "prompt",
    context: {},
    generationError: undefined
  };
}
