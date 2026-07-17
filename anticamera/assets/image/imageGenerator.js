import { LocalPrototypeProvider } from "./localPrototypeProvider.js";
import { OpenAIImagesProvider } from "./openAIImagesProvider.js";
import { EndpointImageProvider } from "./endpointImageProvider.js";
import { OpenAIKeyStore } from "./keyStore.js";
export class ImageGenerator {
    keyStore = new OpenAIKeyStore();
    async generate(request) {
        const provider = this.chooseProvider();
        return provider.generate(request);
    }
    hasUserKey() {
        return Boolean(this.keyStore.getKey());
    }
    canGenerate() {
        try {
            this.chooseProvider();
            return true;
        }
        catch {
            return false;
        }
    }
    providerId() {
        return this.chooseProvider().id;
    }
    saveUserKey(value) {
        this.keyStore.setKey(value);
    }
    chooseProvider() {
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
function readRuntimeConfig() {
    const fromWindow = window.ANTICAMERA_CONFIG || {};
    const storedHeaders = safeStorageGet("anticamera.endpoint.headers");
    const storedProvider = safeStorageGet("anticamera.provider");
    return {
        ...fromWindow,
        provider: validProvider(storedProvider) || fromWindow.provider,
        openaiApiKey: safeStorageGet("anticamera.openai.key") || fromWindow.openaiApiKey,
        openaiModel: safeStorageGet("anticamera.openai.model") || fromWindow.openaiModel,
        endpointUrl: safeStorageGet("anticamera.endpoint.url") || fromWindow.endpointUrl,
        endpointHeaders: parseEndpointHeaders(storedHeaders) || fromWindow.endpointHeaders
    };
}
function safeStorageGet(key) {
    try {
        return localStorage.getItem(key) || undefined;
    }
    catch {
        return undefined;
    }
}
function validProvider(value) {
    return value === "openai" || value === "endpoint" || value === "local" ? value : undefined;
}
function parseEndpointHeaders(raw) {
    if (!raw) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return undefined;
        }
        const headers = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof key === "string" && typeof value === "string") {
                headers[key] = value;
            }
        }
        return headers;
    }
    catch {
        return undefined;
    }
}
