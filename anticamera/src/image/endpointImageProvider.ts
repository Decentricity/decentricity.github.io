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

export class EndpointImageProvider implements ImageGeneratorProvider {
  readonly id = "configurable-endpoint";

  constructor(
    private readonly endpointUrl: string,
    private readonly headers: Record<string, string>
  ) {}

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const response = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers
      },
      body: JSON.stringify({
        prompt: request.prompt,
        context: request.context
      })
    });

    const data = (await response.json()) as EndpointImageResponse;
    if (!response.ok) {
      throw new Error(`image endpoint failed: ${response.status}`);
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

