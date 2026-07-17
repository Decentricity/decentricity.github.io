export class OpenAIImagesProvider {
    apiKey;
    model;
    id = "openai-images";
    constructor(apiKey, model = "gpt-image-2") {
        this.apiKey = apiKey;
        this.model = model;
    }
    async generate(request) {
        const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
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
        const data = (await response.json());
        if (!response.ok) {
            throw new Error(data.error?.message || `OpenAI image request failed: ${response.status}`);
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
