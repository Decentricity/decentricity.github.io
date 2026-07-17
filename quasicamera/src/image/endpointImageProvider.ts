import type { ImageGenerationRequest, ImageGenerationResult } from "../types.js";
import type { ImageGeneratorProvider } from "./imageGenerator.js";

interface EndpointImageResponse {
  imageDataUrl?: string;
  dataUrl?: string;
  b64_json?: string;
  image_base64?: string;
  url?: string;
  provider?: string;
}

const ENDPOINT_TIMEOUT_MS = 300_000;

export class EndpointImageProvider implements ImageGeneratorProvider {
  readonly id = "configurable-endpoint";

  constructor(
    private readonly endpointUrl: string,
    private readonly headers: Record<string, string>,
    private readonly timeoutMs = ENDPOINT_TIMEOUT_MS
  ) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;

    try {
      response = await fetch(this.endpointUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...this.headers
        },
        body: JSON.stringify({
          prompt: request.prompt,
          context: request.context,
          sourceImage: request.sourceImage,
          faceReferences: request.faceReferences,
          inputFidelity: request.inputFidelity
        })
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error("image endpoint request timed out");
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    const text = await response.text();
    const data = parseResponse(text);
    if (!response.ok) {
      throw new Error(text ? `image endpoint failed: ${response.status} ${text}` : `image endpoint failed: ${response.status}`);
    }

    const base64 = data.b64_json || data.image_base64;
    const imageDataUrl = data.imageDataUrl || data.dataUrl || data.url || (base64 ? `data:image/png;base64,${base64}` : undefined);
    if (!imageDataUrl) {
      throw new Error("image endpoint did not return an image");
    }

    return {
      imageDataUrl,
      provider: data.provider || this.id
    };
  }
}

function parseResponse(text: string): EndpointImageResponse {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as EndpointImageResponse;
  } catch {
    return {};
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
