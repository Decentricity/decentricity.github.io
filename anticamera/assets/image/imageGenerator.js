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
    const storedHeaders = localStorage.getItem("anticamera.endpoint.headers");
    return {
        ...fromWindow,
        provider: localStorage.getItem("anticamera.provider") || fromWindow.provider,
        openaiApiKey: localStorage.getItem("anticamera.openai.key") || fromWindow.openaiApiKey,
        openaiModel: localStorage.getItem("anticamera.openai.model") || fromWindow.openaiModel,
        endpointUrl: localStorage.getItem("anticamera.endpoint.url") || fromWindow.endpointUrl,
        endpointHeaders: storedHeaders ? JSON.parse(storedHeaders) : fromWindow.endpointHeaders
    };
}
