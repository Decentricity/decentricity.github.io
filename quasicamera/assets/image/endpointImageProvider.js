const ENDPOINT_TIMEOUT_MS = 300_000;
export class EndpointImageProvider {
    endpointUrl;
    headers;
    timeoutMs;
    id = "configurable-endpoint";
    constructor(endpointUrl, headers, timeoutMs = ENDPOINT_TIMEOUT_MS) {
        this.endpointUrl = endpointUrl;
        this.headers = headers;
        this.timeoutMs = timeoutMs;
    }
    async generate(request) {
        const controller = new AbortController();
        const timeoutId = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
        let response;
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
        }
        catch (error) {
            if (isAbortError(error)) {
                throw new Error("image endpoint request timed out");
            }
            throw error;
        }
        finally {
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
