export class EndpointImageProvider {
    endpointUrl;
    headers;
    id = "configurable-endpoint";
    constructor(endpointUrl, headers) {
        this.endpointUrl = endpointUrl;
        this.headers = headers;
    }
    async generate(request) {
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
        const data = (await response.json());
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
