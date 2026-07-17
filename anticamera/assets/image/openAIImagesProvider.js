const OPENAI_IMAGE_TIMEOUT_MS = 120_000;
export class OpenAIImagesProvider {
    apiKey;
    model;
    timeoutMs;
    id = "openai-images";
    constructor(apiKey, model = "gpt-image-2", timeoutMs = OPENAI_IMAGE_TIMEOUT_MS) {
        this.apiKey = apiKey;
        this.model = model;
        this.timeoutMs = timeoutMs;
    }
    async generate(request) {
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
