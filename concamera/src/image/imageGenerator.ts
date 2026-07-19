import type { ImageGenerationRequest, ImageGenerationResult } from "../types.js";
import { LocalPrototypeProvider } from "./localPrototypeProvider.js";
import { OpenAIImagesProvider } from "./openAIImagesProvider.js";
import { EndpointImageProvider } from "./endpointImageProvider.js";
import { OpenAIKeyStore } from "./keyStore.js";

export interface ImageGeneratorProvider {
  readonly id: string;
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface AntiCameraRuntimeConfig {
  provider?: "openai" | "endpoint" | "local" | undefined;
  openaiApiKey?: string | undefined;
  openaiModel?: string | undefined;
  endpointUrl?: string | undefined;
  endpointHeaders?: Record<string, string> | undefined;
}

declare global {
  interface Window {
    CONCAMERA_CONFIG?: AntiCameraRuntimeConfig;
  }
}

export class ImageGenerator {
  private readonly keyStore = new OpenAIKeyStore();

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const provider = this.chooseProvider();
    return provider.generate(request);
  }

  hasUserKey(): boolean {
    return Boolean(this.keyStore.getKey());
  }

  canGenerate(): boolean {
    try {
      this.chooseProvider();
      return true;
    } catch {
      return false;
    }
  }

  providerId(): string {
    return this.chooseProvider().id;
  }

  saveUserKey(value: string): void {
    this.keyStore.setKey(value);
  }

  private chooseProvider(): ImageGeneratorProvider {
    const config = readRuntimeConfig();

    if (config.provider === "local") {
      return new LocalPrototypeProvider();
    }

    if ((config.provider === "endpoint" || config.endpointUrl) && config.endpointUrl) {
      return new EndpointImageProvider(config.endpointUrl, config.endpointHeaders || {});
    }

    const openaiApiKey = config.openaiApiKey || this.keyStore.getKey();
    if (openaiApiKey) {
      return new OpenAIImagesProvider(openaiApiKey, config.openaiModel || this.keyStore.getModel());
    }

    throw new Error("OpenAI secret required");
  }
}

function readRuntimeConfig(): AntiCameraRuntimeConfig {
  const fromWindow = window.CONCAMERA_CONFIG || {};
  const storedHeaders = safeStorageGet("concamera.endpoint.headers");
  const storedProvider = safeStorageGet("concamera.provider");

  return {
    ...fromWindow,
    provider: validProvider(storedProvider) || fromWindow.provider,
    openaiApiKey: safeStorageGet("concamera.openai.key") || fromWindow.openaiApiKey,
    openaiModel: safeStorageGet("concamera.openai.model") || fromWindow.openaiModel,
    endpointUrl: safeStorageGet("concamera.endpoint.url") || fromWindow.endpointUrl,
    endpointHeaders: parseEndpointHeaders(storedHeaders) || fromWindow.endpointHeaders
  };
}

function safeStorageGet(key: string): string | undefined {
  try {
    return localStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function validProvider(value: string | undefined): AntiCameraRuntimeConfig["provider"] | undefined {
  return value === "openai" || value === "endpoint" || value === "local" ? value : undefined;
}

function parseEndpointHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === "string" && typeof value === "string") {
        headers[key] = value;
      }
    }

    return headers;
  } catch {
    return undefined;
  }
}
