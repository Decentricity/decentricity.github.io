import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAIImagesProvider } from "../assets/image/openAIImagesProvider.js";

test("OpenAI provider sends source image and face crops to image edits with high fidelity", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return new Response(JSON.stringify({
      data: [{ b64_json: "generated" }]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const provider = new OpenAIImagesProvider("sk-test", "gpt-image-1.5", 1000);
    const result = await provider.generate({
      context: minimalContext(),
      prompt: "transform this source while preserving one face",
      sourceImage: {
        role: "source",
        name: "source.jpg",
        dataUrl: "data:image/jpeg;base64,source"
      },
      faceReferences: [{
        role: "face-reference",
        name: "face.jpg",
        dataUrl: "data:image/jpeg;base64,face"
      }],
      inputFidelity: "high"
    });

    assert.equal(capturedRequest.url, "https://api.openai.com/v1/images/edits");
    assert.equal(capturedRequest.init.method, "POST");
    assert.equal(capturedRequest.init.headers.Authorization, "Bearer sk-test");
    const body = JSON.parse(capturedRequest.init.body);
    assert.equal(body.model, "gpt-image-1.5");
    assert.equal(body.input_fidelity, "high");
    assert.equal(body.images.length, 2);
    assert.equal(body.images[0].image_url, "data:image/jpeg;base64,source");
    assert.equal(body.images[1].image_url, "data:image/jpeg;base64,face");
    assert.equal(body.prompt, "transform this source while preserving one face");
    assert.equal(result.imageDataUrl, "data:image/png;base64,generated");
    assert.equal(result.provider, "openai-images-edit");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI provider can send face references without a source image for Free grounding", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return new Response(JSON.stringify({
      data: [{ b64_json: "generated-free" }]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const provider = new OpenAIImagesProvider("sk-test", "gpt-image-1.5", 1000);
    const result = await provider.generate({
      context: minimalContext(),
      prompt: "create from face references and semantic structure",
      generationGrounding: "free",
      faceReferences: [{
        role: "face-reference",
        name: "face.jpg",
        dataUrl: "data:image/jpeg;base64,face"
      }],
      inputFidelity: "high"
    });

    assert.equal(capturedRequest.url, "https://api.openai.com/v1/images/edits");
    const body = JSON.parse(capturedRequest.init.body);
    assert.equal(body.images.length, 1);
    assert.equal(body.images[0].image_url, "data:image/jpeg;base64,face");
    assert.equal(body.prompt, "create from face references and semantic structure");
    assert.equal(result.imageDataUrl, "data:image/png;base64,generated-free");
    assert.equal(result.provider, "openai-images-edit");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function minimalContext() {
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
      label: "Depok, Indonesia"
    },
    weather: {
      status: "granted",
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
      subjectMode: "single-person",
      flashMode: "off",
      iso: 200,
      focalDistance: "21mm",
      groundingMode: "grounded"
    },
    orientation: {
      status: "granted",
      aim: "Upward"
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
      status: "granted"
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
