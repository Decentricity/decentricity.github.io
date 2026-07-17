const OPENAI_IMAGE_TIMEOUT_MS = 300_000;
export class OpenAIImagesProvider {
    apiKey;
    model;
    timeoutMs;
    id = "openai-images";
    constructor(apiKey, model = "gpt-image-1.5", timeoutMs = OPENAI_IMAGE_TIMEOUT_MS) {
        this.apiKey = apiKey;
        this.model = model;
        this.timeoutMs = timeoutMs;
    }
    async generate(request) {
        if (request.sourceImage) {
            return this.edit(request);
        }
        return this.generateFromPrompt(request);
    }
    async generateFromPrompt(request) {
        const controller = new AbortController();
        const timeoutId = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
        let response;
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
        }
        catch (error) {
            if (isAbortError(error)) {
                throw new Error("OpenAI image request timed out");
            }
            throw error;
        }
        finally {
            globalThis.clearTimeout(timeoutId);
        }
        const text = await response.text();
        const data = parseResponse(text);
        if (!response.ok) {
            const detail = data.error?.message || text;
            throw new Error(detail
                ? `OpenAI image request failed: ${response.status} ${detail}`
                : `OpenAI image request failed: ${response.status}`);
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
    async edit(request) {
        const controller = new AbortController();
        const timeoutId = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
        const images = [
            { image_url: request.sourceImage?.dataUrl },
            ...(request.faceReferences ?? []).map((reference) => ({ image_url: reference.dataUrl }))
        ].filter((image) => Boolean(image.image_url));
        let response;
        if (images.length === 0) {
            throw new Error("QuasiCamera image edit requires a source image");
        }
        try {
            response = await fetch("https://api.openai.com/v1/images/edits", {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    images,
                    input_fidelity: request.inputFidelity ?? "high",
                    prompt: request.prompt,
                    size: "1024x1024",
                    n: 1,
                    output_format: "png",
                    quality: "high"
                })
            });
        }
        catch (error) {
            if (isAbortError(error)) {
                throw new Error("OpenAI image edit request timed out");
            }
            throw error;
        }
        finally {
            globalThis.clearTimeout(timeoutId);
        }
        const text = await response.text();
        const data = parseResponse(text);
        if (!response.ok) {
            const detail = data.error?.message || text;
            throw new Error(detail
                ? `OpenAI image edit request failed: ${response.status} ${detail}`
                : `OpenAI image edit request failed: ${response.status}`);
        }
        const first = data.data?.[0];
        if (first?.b64_json) {
            return {
                imageDataUrl: `data:image/png;base64,${first.b64_json}`,
                provider: `${this.id}-edit`
            };
        }
        if (first?.url) {
            return {
                imageDataUrl: first.url,
                provider: `${this.id}-edit`
            };
        }
        throw new Error("OpenAI image edit response did not include an image");
    }
}
function parseResponse(text) {
    if (!text) {
        return {};
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return {};
    }
}
function isAbortError(error) {
    return error instanceof DOMException
        ? error.name === "AbortError"
        : error instanceof Error && error.name === "AbortError";
}
