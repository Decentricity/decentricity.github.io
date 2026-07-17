import type { AntiCameraFrame } from "../types.js";
import { FrameStorage } from "./storage.js";

export class Gallery {
  private frames: AntiCameraFrame[] = [];

  constructor(
    private readonly strip: HTMLOListElement,
    private readonly exportButton: HTMLButtonElement,
    private readonly storage: FrameStorage
  ) {
    this.exportButton.addEventListener("click", () => this.exportJson());
  }

  async load(): Promise<void> {
    this.frames = await this.storage.loadFrames();
    this.render();
  }

  async add(frame: AntiCameraFrame): Promise<void> {
    this.frames.unshift(frame);
    await this.storage.saveFrame(frame);
    this.render(frame.id);
  }

  private render(newId?: string): void {
    this.strip.replaceChildren();
    this.exportButton.disabled = this.frames.length === 0;

    for (const frame of this.frames) {
      const item = document.createElement("li");
      item.className = `film-frame${frame.id === newId ? " new" : ""}`;
      item.title = `${frame.context.location.label} | ${frame.context.weather.description} | ${frame.context.audio.descriptor}`;

      const image = document.createElement("img");
      image.src = frame.imageDataUrl;
      image.alt = "Anti-Camera generated frame";
      image.loading = "lazy";

      const timestamp = document.createElement("time");
      timestamp.dateTime = frame.timestamp;
      timestamp.textContent = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(frame.timestamp));

      item.append(image, timestamp);
      this.strip.append(item);
    }
  }

  private exportJson(): void {
    const blob = this.storage.exportMetadata(this.frames);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `anti-camera-metadata-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}

