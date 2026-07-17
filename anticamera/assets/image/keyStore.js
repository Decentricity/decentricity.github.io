const OPENAI_KEY_STORAGE = "anticamera.openai.key";
const OPENAI_MODEL_STORAGE = "anticamera.openai.model";
export class OpenAIKeyStore {
    getKey() {
        return localStorage.getItem(OPENAI_KEY_STORAGE) || undefined;
    }
    setKey(value) {
        localStorage.setItem(OPENAI_KEY_STORAGE, value.trim());
    }
    clearKey() {
        localStorage.removeItem(OPENAI_KEY_STORAGE);
    }
    getModel(defaultModel = "gpt-image-2") {
        return localStorage.getItem(OPENAI_MODEL_STORAGE) || defaultModel;
    }
}
