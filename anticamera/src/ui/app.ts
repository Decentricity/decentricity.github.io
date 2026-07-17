import type { AntiCameraFrame, IndoorOutdoor } from "../types.js";
import { ContextCollector } from "../context/contextCollector.js";
import { Gallery } from "../gallery/gallery.js";
import { ImageGenerator } from "../image/imageGenerator.js";
import { PromptBuilder } from "../promptBuilder.js";
import { ManualControls } from "./manualControls.js";
import { renderBattery, renderReadout } from "./readout.js";
import { ShutterSound } from "./shutterSound.js";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class AntiCameraApp {
  private readonly context = new ContextCollector();
  private readonly promptBuilder = new PromptBuilder();
  private readonly imageGenerator = new ImageGenerator();
  private readonly shutterSound = new ShutterSound();
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
    private readonly gallery: Gallery
  ) {}

  async start(): Promise<void> {
    await this.gallery.load();
    await this.context.startPassiveCollection();
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
    this.lastContext = await this.context.snapshot(this.mode(), undefined, this.manualControls.currentSettings());
    renderReadout(this.readout, this.lastContext);
    renderBattery(this.batteryFill, this.batteryLabel, this.lastContext);
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
    this.developing = true;
    this.shutter.disabled = true;
    this.shutterSound.play();
    await this.context.primeFromUserGesture();

    const context = await this.context.snapshot(this.mode(), frozenPose, frozenSettings);
    const prompt = this.promptBuilder.build(context);
    const minimumDevelopingTime = 2600 + Math.round(Math.random() * 1800);

    this.showDeveloping();
    let result;
    try {
      [result] = await Promise.all([
        this.imageGenerator.generate({ context, prompt }),
        delay(minimumDevelopingTime)
      ]);
    } catch (error) {
      await delay(minimumDevelopingTime);
      this.showKeyPanel(error instanceof Error ? error.message : String(error));
      this.shutter.disabled = false;
      this.developing = false;
      return;
    }

    const frame: AntiCameraFrame = {
      id: crypto.randomUUID(),
      timestamp: context.capturedAt,
      imageDataUrl: result.imageDataUrl,
      provider: result.provider,
      prompt,
      context,
      generationError: result.fallbackReason
    };

    await this.gallery.add(frame);
    await this.reveal(frame.imageDataUrl);
    this.shutter.disabled = false;
    this.developing = false;
    await this.refreshReadout();
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
    this.latestFrame.src = imageDataUrl;
    this.latestFrame.classList.remove("hidden");
    this.latestFrame.classList.add("is-developing");
    this.developingLayer.classList.add("hidden");
    await delay(80);
    this.latestFrame.classList.remove("is-developing");
    await delay(3600);
    this.latestFrame.classList.add("hidden");
    this.viewfinder.classList.remove("is-dark");
  }
}
