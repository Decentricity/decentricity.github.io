import type { ImageGenerationRequest, ImageGenerationResult } from "../types.js";
import type { ImageGeneratorProvider } from "./imageGenerator.js";

interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
}

const OPENAI_IMAGE_TIMEOUT_MS = 120_000;

export class OpenAIImagesProvider implements ImageGeneratorProvider {
  readonly id = "openai-images";

  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-image-2",
    private readonly timeoutMs = OPENAI_IMAGE_TIMEOUT_MS
  ) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;

    try {
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          prompt: request.prompt,
          size: "1024x1024",
          n: 1
        })
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error("OpenAI image request timed out");
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

    const text = await response.text();
    const data = parseResponse(text);
    if (!response.ok) {
      throw new Error(data.error?.message || text || `OpenAI image request failed: ${response.status}`);
    }

    const first = data.data?.[0];
    if (first?.b64_json) {
      return {
        imageDataUrl: `data:image/png;base64,${first.b64_json}`,
        provider: this.id
      };
    }

    if (first?.url) {
      return {
        imageDataUrl: first.url,
        provider: this.id
      };
    }

    throw new Error("OpenAI image response did not include an image");
  }
}

function parseResponse(text: string): OpenAIImageResponse {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as OpenAIImageResponse;
  } catch {
    return {};
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
