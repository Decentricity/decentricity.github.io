import type { AntiCameraFrame, IndoorOutdoor } from "../types.js";
import { ContextCollector } from "../context/contextCollector.js";
import { Gallery } from "../gallery/gallery.js";
import { ImageGenerator } from "../image/imageGenerator.js";
import { PromptBuilder } from "../promptBuilder.js";
import { ManualControls } from "./manualControls.js";
import { renderBattery, renderReadout } from "./readout.js";
import { ShutterSound } from "./shutterSound.js";

const PERMISSION_TIMEOUT_MS = 8_000;
const CONTEXT_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 120_000;
const IMAGE_LOAD_TIMEOUT_MS = 15_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

type CaptureContext = Pick<ContextCollector, "startPassiveCollection" | "primeFromUserGesture" | "freezeCameraPose" | "snapshot">;
type CapturePromptBuilder = Pick<PromptBuilder, "build">;
type CaptureImageGenerator = Pick<ImageGenerator, "canGenerate" | "generate" | "saveUserKey"> & {
  providerId?: () => string;
};
type CaptureDelay = (ms: number) => Promise<void>;

interface AntiCameraAppDependencies {
  context?: CaptureContext;
  promptBuilder?: CapturePromptBuilder;
  imageGenerator?: CaptureImageGenerator;
  shutterSound?: Pick<ShutterSound, "play">;
  delay?: CaptureDelay;
  minimumDevelopingTime?: () => number;
  imageLoadTimeoutMs?: number;
  permissionTimeoutMs?: number;
  contextTimeoutMs?: number;
  generationTimeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

function createFrameId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `frame-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class AntiCameraApp {
  private readonly context: CaptureContext;
  private readonly promptBuilder: CapturePromptBuilder;
  private readonly imageGenerator: CaptureImageGenerator;
  private readonly shutterSound: Pick<ShutterSound, "play">;
  private readonly captureDelay: CaptureDelay;
  private readonly minimumDevelopingTime: () => number;
  private readonly imageLoadTimeoutMs: number;
  private readonly permissionTimeoutMs: number;
  private readonly contextTimeoutMs: number;
  private readonly generationTimeoutMs: number;
  private readonly debugCapture = new CaptureDebugger();
  private developing = false;
  private lastContext: Awaited<ReturnType<ContextCollector["snapshot"]>> | null = null;

  constructor(
    private readonly viewfinder: HTMLElement,
    private readonly readout: HTMLElement,
    private readonly developingLayer: HTMLElement,
    private readonly latestFrame: HTMLImageElement,
    private readonly keyPanel: HTMLFormElement,
    private readonly keyInput: HTMLInputElement,
    private readonly keyMessage: HTMLElement,
    private readonly batteryFill: HTMLElement,
    private readonly batteryLabel: HTMLElement,
    private readonly shutter: HTMLButtonElement,
    private readonly modeInputs: NodeListOf<HTMLInputElement>,
    private readonly manualControls: ManualControls,
    private readonly gallery: Gallery,
    dependencies: AntiCameraAppDependencies = {}
  ) {
    this.context = dependencies.context ?? new ContextCollector();
    this.promptBuilder = dependencies.promptBuilder ?? new PromptBuilder();
    this.imageGenerator = dependencies.imageGenerator ?? new ImageGenerator();
    this.shutterSound = dependencies.shutterSound ?? new ShutterSound();
    this.captureDelay = dependencies.delay ?? delay;
    this.minimumDevelopingTime = dependencies.minimumDevelopingTime ?? (() => 2600 + Math.round(Math.random() * 1800));
    this.imageLoadTimeoutMs = dependencies.imageLoadTimeoutMs ?? IMAGE_LOAD_TIMEOUT_MS;
    this.permissionTimeoutMs = dependencies.permissionTimeoutMs ?? PERMISSION_TIMEOUT_MS;
    this.contextTimeoutMs = dependencies.contextTimeoutMs ?? CONTEXT_TIMEOUT_MS;
    this.generationTimeoutMs = dependencies.generationTimeoutMs ?? GENERATION_TIMEOUT_MS;
  }

  async start(): Promise<void> {
    await this.gallery.load().catch((error) => this.debugCapture.log("capture:gallery-load-error", { error: safeError(error) }));
    await this.context.startPassiveCollection().catch((error) => this.debugCapture.log("capture:passive-context-error", { error: safeError(error) }));
    this.shutter.addEventListener("click", () => {
      void this.capture();
    });
    this.keyPanel.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveKey();
    });
    this.manualControls.onChange(() => {
      if (!this.developing && this.keyPanel.classList.contains("hidden")) {
        void this.refreshReadout();
      }
    });

    await this.refreshReadout();
    if (!this.imageGenerator.canGenerate()) {
      this.showKeyPanel();
    }
    window.setInterval(() => {
      if (!this.developing && this.latestFrame.classList.contains("hidden") && this.keyPanel.classList.contains("hidden")) {
        void this.refreshReadout();
      }
    }, 1_000);
  }

  private async refreshReadout(): Promise<void> {
    try {
      this.lastContext = await withTimeout(
        this.context.snapshot(this.mode(), undefined, this.manualControls.currentSettings()),
        this.contextTimeoutMs,
        "context refresh"
      );
      renderReadout(this.readout, this.lastContext);
      renderBattery(this.batteryFill, this.batteryLabel, this.lastContext);
    } catch (error) {
      this.debugCapture.log("capture:readout-error", { error: safeError(error) });
    }
  }

  private async capture(): Promise<void> {
    if (this.developing) {
      return;
    }

    if (!this.imageGenerator.canGenerate()) {
      this.showKeyPanel();
      return;
    }

    const frozenPose = this.context.freezeCameraPose();
    const frozenSettings = this.manualControls.freezeSettings();
    const minimumDevelopingTime = this.minimumDevelopingTime();

    this.developing = true;
    this.shutter.disabled = true;
    this.shutterSound.play();
    this.showDeveloping();

    try {
      this.debugCapture.log("capture:start");
      this.debugCapture.log("capture:permissions-start");
      await withTimeout(this.context.primeFromUserGesture(), this.permissionTimeoutMs, "sensor permissions")
        .catch((error) => this.debugCapture.log("capture:permissions-error", { error: safeError(error) }));
      this.debugCapture.log("capture:permissions-complete");

      const context = await withTimeout(
        this.context.snapshot(this.mode(), frozenPose, frozenSettings, { waitForReverseGeocodeMs: 900 }),
        this.contextTimeoutMs,
        "context snapshot"
      );
      this.debugCapture.log("capture:context-complete", { capturedAt: context.capturedAt });

      const prompt = this.promptBuilder.build(context);
      this.debugCapture.log("capture:prompt-complete", { promptLength: prompt.length });
      this.debugCapture.log("capture:provider-selected", { provider: this.imageGenerator.providerId?.() ?? "unknown" });

      this.debugCapture.log("capture:request-start");
      const [result] = await Promise.all([
        withTimeout(this.imageGenerator.generate({ context, prompt }), this.generationTimeoutMs, "image generation"),
        this.captureDelay(minimumDevelopingTime)
      ]);
      this.debugCapture.log("capture:request-response", { provider: result.provider });

      const frame: AntiCameraFrame = {
        id: createFrameId(),
        timestamp: context.capturedAt,
        imageDataUrl: result.imageDataUrl,
        provider: result.provider,
        prompt,
        context,
        generationError: result.fallbackReason
      };

      this.debugCapture.log("capture:reveal-start");
      await this.reveal(frame.imageDataUrl);

      try {
        this.debugCapture.log("capture:gallery-save-start");
        await this.gallery.add(frame);
        this.debugCapture.log("capture:gallery-save-complete");
      } catch (storageError) {
        this.reportNonFatalStorageFailure(storageError);
      }

      await this.refreshReadout();
      this.debugCapture.log("capture:complete");
    } catch (error) {
      this.debugCapture.log("capture:error", { error: safeError(error) });
      await this.captureDelay(minimumDevelopingTime).catch(() => undefined);
      if (isAuthenticationError(error)) {
        this.showKeyPanel(error instanceof Error ? error.message : String(error));
      } else {
        this.showCaptureError(error);
      }
    } finally {
      this.shutter.disabled = false;
      this.developing = false;
    }
  }

  private mode(): IndoorOutdoor {
    const selected = [...this.modeInputs].find((input) => input.checked);
    return selected?.value === "indoor" ? "indoor" : "outdoor";
  }

  private showDeveloping(): void {
    this.viewfinder.classList.add("is-dark");
    this.viewfinder.classList.remove("needs-key");
    this.keyPanel.classList.add("hidden");
    this.latestFrame.classList.add("hidden");
    this.latestFrame.classList.remove("is-developing");
    this.developingLayer.textContent = "Developing...";
    this.developingLayer.classList.remove("hidden");
  }

  private showKeyPanel(message = "USER KEY REQUIRED"): void {
    this.viewfinder.classList.remove("is-dark");
    this.viewfinder.classList.add("needs-key");
    this.developingLayer.classList.add("hidden");
    this.latestFrame.classList.add("hidden");
    this.keyPanel.classList.remove("hidden");
    this.keyMessage.textContent = message.toUpperCase();
    this.keyInput.focus();
  }

  private showCaptureError(error: unknown): void {
    this.viewfinder.classList.add("is-dark");
    this.viewfinder.classList.remove("needs-key");
    this.keyPanel.classList.add("hidden");
    this.latestFrame.classList.add("hidden");
    this.developingLayer.textContent = captureErrorMessage(error);
    this.developingLayer.classList.remove("hidden");
  }

  private reportNonFatalStorageFailure(error: unknown): void {
    this.debugCapture.log("capture:gallery-save-error", { error: safeError(error) });
  }

  private saveKey(): void {
    const value = this.keyInput.value.trim();
    if (!value) {
      this.keyMessage.textContent = "USER KEY REQUIRED";
      return;
    }

    this.imageGenerator.saveUserKey(value);
    this.keyInput.value = "";
    this.keyPanel.classList.add("hidden");
    this.viewfinder.classList.remove("needs-key");
    void this.refreshReadout();
  }

  private async reveal(imageDataUrl: string): Promise<void> {
    await this.loadLatestFrame(imageDataUrl);
    this.latestFrame.classList.remove("hidden");
    this.latestFrame.classList.add("is-developing");
    this.developingLayer.classList.add("hidden");
    await this.captureDelay(80);
    this.latestFrame.classList.remove("is-developing");
    await this.captureDelay(3600);
    this.latestFrame.classList.add("hidden");
    this.viewfinder.classList.remove("is-dark");
  }

  private loadLatestFrame(imageDataUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
      const cleanup = (): void => {
        if (timeoutId !== undefined) {
          globalThis.clearTimeout(timeoutId);
        }
        this.latestFrame.onload = null;
        this.latestFrame.onerror = null;
      };
      const complete = (): void => {
        cleanup();
        resolve();
      };
      const fail = (): void => {
        cleanup();
        reject(new Error("Generated image failed to load"));
      };

      this.latestFrame.onload = complete;
      this.latestFrame.onerror = fail;
      timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(new Error("Generated image load timed out"));
      }, this.imageLoadTimeoutMs);
      this.latestFrame.src = imageDataUrl;

      if (this.latestFrame.complete && this.latestFrame.naturalWidth > 0) {
        complete();
      }
    });
  }
}

function isAuthenticationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /secret required|api key|authentication|unauthorized|401/i.test(message);
}

function captureErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out|timeout/i.test(message)) {
    return "NETWORK TIMEOUT\nPRESS SHUTTER TO RETRY";
  }

  if (/quota|storage|indexeddb|localstorage/i.test(message)) {
    return "FILM STORAGE FULL\nFRAME SHOWN; EXPORT OR CLEAR FILM";
  }

  if (/model/i.test(message)) {
    return "MODEL ERROR\nPRESS SHUTTER TO RETRY";
  }

  return "EXPOSURE FAILED\nPRESS SHUTTER TO RETRY";
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class CaptureDebugger {
  private readonly enabled = debugCaptureEnabled();
  private readonly startedAt = Date.now();

  log(stage: string, detail: Record<string, unknown> = {}): void {
    if (!this.enabled) {
      return;
    }

    console.debug("[anti-camera]", stage, {
      elapsedMs: Date.now() - this.startedAt,
      ...detail
    });
  }
}

function debugCaptureEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("debugCapture") === "1";
}
