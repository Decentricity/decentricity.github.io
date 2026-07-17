import type { AntiCameraFrame } from "../types.js";
import { FrameStorage } from "./storage.js";
import type { CaptureJobStatus } from "../capture/captureQueue.js";
import { buildFilmDownloadFilename, composeFilmFramePng } from "./filmExport.js";

export interface FilmPlaceholder {
  id: string;
  timestamp: string;
  status: CaptureJobStatus;
  error?: string | undefined;
}

type FilmItem =
  | { kind: "frame"; frame: AntiCameraFrame }
  | { kind: "placeholder"; placeholder: FilmPlaceholder };

type RetryListener = (id: string) => void;

export class Gallery {
  private items: FilmItem[] = [];
  private retryListener: RetryListener | null = null;
  private zoomFrame: AntiCameraFrame | null = null;

  constructor(
    private readonly strip: HTMLOListElement,
    private readonly exportButton: HTMLButtonElement,
    private readonly storage: FrameStorage,
    private readonly zoomPanel: HTMLElement,
    private readonly zoomImage: HTMLImageElement,
    private readonly zoomTime: HTMLTimeElement,
    private readonly zoomCloseButton: HTMLButtonElement,
    private readonly zoomSaveButton: HTMLButtonElement
  ) {
    this.exportButton.addEventListener("click", () => this.exportJson());
    this.strip.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-retry-job]") : null;
      if (target instanceof HTMLElement) {
        this.retryListener?.(target.dataset.retryJob ?? "");
        return;
      }

      const frameTarget = event.target instanceof Element ? event.target.closest("[data-frame-id]") : null;
      if (frameTarget instanceof HTMLElement) {
        this.openZoom(frameTarget.dataset.frameId ?? "");
      }
    });
    this.strip.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const frameTarget = event.target instanceof Element ? event.target.closest("[data-frame-id]") : null;
      if (frameTarget instanceof HTMLElement) {
        event.preventDefault();
        this.openZoom(frameTarget.dataset.frameId ?? "");
      }
    });
    this.zoomCloseButton.addEventListener("click", () => this.closeZoom());
    this.zoomSaveButton.addEventListener("click", () => {
      void this.saveZoomFrame();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.zoomPanel.hidden) {
        this.closeZoom();
      }
    });
  }

  async load(): Promise<void> {
    this.items = (await this.storage.loadFrames()).map((frame) => ({ kind: "frame", frame }));
    this.render();
  }

  onRetry(listener: RetryListener): void {
    this.retryListener = listener;
  }

  async add(frame: AntiCameraFrame): Promise<void> {
    this.items.unshift({ kind: "frame", frame });
    await this.storage.saveFrame(frame);
    this.render(frame.id);
  }

  addPlaceholder(placeholder: FilmPlaceholder): void {
    this.items.unshift({ kind: "placeholder", placeholder });
    this.render(placeholder.id);
  }

  updatePlaceholder(id: string, patch: Partial<FilmPlaceholder>): void {
    const item = this.items.find((candidate) => candidate.kind === "placeholder" && candidate.placeholder.id === id);
    if (!item || item.kind !== "placeholder") {
      return;
    }

    item.placeholder = {
      ...item.placeholder,
      ...patch
    };
    this.render();
  }

  async completePlaceholder(frame: AntiCameraFrame): Promise<void> {
    const index = this.items.findIndex((item) => item.kind === "placeholder" && item.placeholder.id === frame.id);
    if (index === -1) {
      this.items.unshift({ kind: "frame", frame });
    } else {
      this.items[index] = { kind: "frame", frame };
    }

    this.render(frame.id);
    await this.storage.saveFrame(frame);
  }

  failPlaceholder(id: string, error: string): void {
    this.updatePlaceholder(id, {
      status: "error",
      error
    });
  }

  frameOrder(): string[] {
    return this.items.map((item) => item.kind === "frame" ? item.frame.id : item.placeholder.id);
  }

  private render(newId?: string): void {
    this.strip.replaceChildren();
    const frames = this.frames();
    this.exportButton.disabled = frames.length === 0;

    for (const item of this.items) {
      if (item.kind === "placeholder") {
        this.strip.append(this.renderPlaceholder(item.placeholder, newId));
      } else {
        this.strip.append(this.renderFrame(item.frame, newId));
      }
    }
  }

  private renderFrame(frame: AntiCameraFrame, newId?: string): HTMLLIElement {
    const item = document.createElement("li");
    item.className = `film-frame${frame.id === newId ? " new" : ""}`;
    item.title = `${frame.context.location.label} | ${frame.context.weather.description} | ${frame.context.audio.descriptor}`;
    item.dataset.frameId = frame.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Open film frame from ${formatTimestamp(frame.timestamp)}`);

    const image = document.createElement("img");
    image.src = frame.imageDataUrl;
    image.alt = "QuasiCamera generated frame";
    image.loading = "lazy";

    const timestamp = document.createElement("time");
    timestamp.dateTime = frame.timestamp;
    timestamp.textContent = formatTimestamp(frame.timestamp);

    item.append(image, timestamp);
    return item;
  }

  private renderPlaceholder(placeholder: FilmPlaceholder, newId?: string): HTMLLIElement {
    const item = document.createElement("li");
    item.className = `film-frame film-frame-pending${placeholder.status === "error" ? " error" : ""}${placeholder.id === newId ? " new" : ""}`;
    item.title = placeholder.status === "error" ? placeholder.error ?? "Exposure failed" : "Developing";

    const panel = placeholder.status === "error" ? document.createElement("button") : document.createElement("div");
    panel.className = "film-placeholder";
    if (placeholder.status === "error") {
      const errorNumber = errorNumberFor(placeholder.error);
      panel.setAttribute("type", "button");
      panel.dataset.retryJob = placeholder.id;
      panel.setAttribute(
        "aria-label",
        errorNumber ? `Exposure failed with error ${errorNumber}. Tap to retry.` : "Exposure failed. Tap to retry."
      );
      panel.textContent = errorNumber ? `EXPOSURE FAILED\nERROR ${errorNumber}\nTAP TO RETRY` : "EXPOSURE FAILED\nTAP TO RETRY";
    } else {
      panel.textContent = "DEVELOPING";
    }

    const timestamp = document.createElement("time");
    timestamp.dateTime = placeholder.timestamp;
    timestamp.textContent = formatTimestamp(placeholder.timestamp);

    item.append(panel, timestamp);
    return item;
  }

  private exportJson(): void {
    const blob = this.storage.exportMetadata(this.frames());
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quasi-camera-metadata-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private frames(): AntiCameraFrame[] {
    return this.items.flatMap((item) => item.kind === "frame" ? [item.frame] : []);
  }

  private openZoom(id: string): void {
    const frame = this.frames().find((candidate) => candidate.id === id);
    if (!frame) {
      return;
    }

    this.zoomFrame = frame;
    this.zoomImage.src = frame.imageDataUrl;
    this.zoomImage.alt = "Enlarged QuasiCamera generated frame";
    this.zoomTime.dateTime = frame.timestamp;
    this.zoomTime.textContent = formatTimestamp(frame.timestamp);
    this.zoomSaveButton.disabled = false;
    this.zoomSaveButton.textContent = "SAVE";
    this.zoomPanel.hidden = false;
    this.zoomPanel.classList.remove("hidden");
    this.zoomCloseButton.focus();
  }

  private closeZoom(): void {
    this.zoomPanel.hidden = true;
    this.zoomPanel.classList.add("hidden");
    this.zoomFrame = null;
  }

  private async saveZoomFrame(): Promise<void> {
    if (!this.zoomFrame) {
      return;
    }

    this.zoomSaveButton.disabled = true;
    this.zoomSaveButton.textContent = "SAVING";
    try {
      const blob = await composeFilmFramePng(this.zoomFrame);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = buildFilmDownloadFilename(this.zoomFrame);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      this.zoomSaveButton.textContent = "SAVED";
      window.setTimeout(() => {
        if (!this.zoomSaveButton.disabled) {
          return;
        }

        this.zoomSaveButton.disabled = false;
        this.zoomSaveButton.textContent = "SAVE";
      }, 900);
    } catch {
      this.zoomSaveButton.disabled = false;
      this.zoomSaveButton.textContent = "SAVE FAILED";
      window.setTimeout(() => {
        this.zoomSaveButton.textContent = "SAVE";
      }, 1400);
    }
  }
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

export function errorNumberFor(error: string | undefined): string | null {
  if (!error) {
    return null;
  }

  const httpLike = error.match(/\b(?:HTTP|status|failed:|error)\s*#?\s*(\d{3})\b/i);
  if (httpLike?.[1]) {
    return httpLike[1];
  }

  const standalone = error.match(/\b([45]\d{2})\b/);
  return standalone?.[1] ?? null;
}
