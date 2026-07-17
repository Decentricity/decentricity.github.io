const OPENAI_KEY_STORAGE = "quasicamera.openai.key";
const OPENAI_MODEL_STORAGE = "quasicamera.openai.model";
const OPENAI_OBJECT_ANALYSIS_MODEL_STORAGE = "quasicamera.openai.objectAnalysisModel";

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

  getObjectAnalysisModel(defaultModel = "gpt-5.6"): string {
    return localStorage.getItem(OPENAI_OBJECT_ANALYSIS_MODEL_STORAGE) || defaultModel;
  }
}
