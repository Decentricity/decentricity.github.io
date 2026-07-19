const OPENAI_KEY_STORAGE = "concamera.openai.key";
const OPENAI_MODEL_STORAGE = "concamera.openai.model";

export class OpenAIKeyStore {
  getKey(): string | undefined {
    return localStorage.getItem(OPENAI_KEY_STORAGE) || undefined;
  }

  setKey(value: string): void {
    localStorage.setItem(OPENAI_KEY_STORAGE, value.trim());
  }

  clearKey(): void {
    localStorage.removeItem(OPENAI_KEY_STORAGE);
  }

  getModel(defaultModel = "gpt-image-1.5"): string {
    return localStorage.getItem(OPENAI_MODEL_STORAGE) || defaultModel;
  }
}
