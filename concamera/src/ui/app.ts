import type {
  AntiCameraContext,
  AntiCameraFrame,
  FaceAnalysis,
  IndoorOutdoor,
  ObjectAnalysis,
  SourcePhotoReference
} from "../types.js";
import { CaptureQueue, type CaptureJob } from "../capture/captureQueue.js";
import { LiveCamera } from "../camera/liveCamera.js";
import { ContextCollector } from "../context/contextCollector.js";
import { BrowserFaceAnalyzer, type FaceAnalyzer } from "../faces/faceAnalyzer.js";
import type { ObjectAnalyzer } from "../objects/objectAnalyzer.js";
import { LocalCnnObjectAnalyzer } from "../objects/localCnnObjectAnalyzer.js";
import { toPersistedObjectMetadata } from "../objects/objectNormalization.js";
import { Gallery } from "../gallery/gallery.js";
import { SemanticOverlayRenderer, type RenderedConCameraFrame } from "../overlay/overlayRenderer.js";
import { ManualControls } from "./manualControls.js";
import { renderBattery, renderReadout } from "./readout.js";
import { ShutterSound } from "./shutterSound.js";

const PERMISSION_TIMEOUT_MS = 8_000;
const CONTEXT_TIMEOUT_MS = 15_000;
const IMAGE_LOAD_TIMEOUT_MS = 15_000;
const MAX_CONCURRENT_ANALYSES = 1;
const MAX_QUEUED_CAPTURES = 10;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

type CaptureContext = Pick<ContextCollector, "startPassiveCollection" | "primeFromUserGesture" | "freezeCameraPose" | "snapshot">;
type CaptureDelay = (ms: number) => Promise<void>;
type CaptureLiveCamera = Pick<LiveCamera, "start" | "captureStill" | "currentStatus" | "toggleCamera" | "currentFacingMode">;
type AppView = "camera" | "film";

interface AntiCameraAppDependencies {
  context?: CaptureContext;
  liveCamera?: CaptureLiveCamera;
  faceAnalyzer?: FaceAnalyzer;
  objectAnalyzer?: ObjectAnalyzer;
  overlayRenderer?: Pick<SemanticOverlayRenderer, "render">;
  shutterSound?: Pick<ShutterSound, "play">;
  delay?: CaptureDelay;
  minimumAnalyzingTime?: () => number;
  imageLoadTimeoutMs?: number;
  permissionTimeoutMs?: number;
  contextTimeoutMs?: number;
  maxConcurrentAnalyses?: number;
  maxQueuedCaptures?: number;
}

interface RuntimeCaptureJob extends CaptureJob {
  permissionReady: Promise<void>;
  contextReady: Promise<AntiCameraContext>;
  minimumAnalyzingTime: number;
  sourcePhoto?: SourcePhotoReference | undefined;
  faceAnalysis?: FaceAnalysis | undefined;
  objectAnalysis?: ObjectAnalysis | undefined;
  renderedFrame?: RenderedConCameraFrame | undefined;
  sourceReleased?: boolean | undefined;
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
  private readonly liveCamera: CaptureLiveCamera;
  private readonly faceAnalyzer: FaceAnalyzer;
  private readonly objectAnalyzer: ObjectAnalyzer;
  private readonly overlayRenderer: Pick<SemanticOverlayRenderer, "render">;
  private readonly shutterSound: Pick<ShutterSound, "play">;
  private readonly captureDelay: CaptureDelay;
  private readonly minimumAnalyzingTime: () => number;
  private readonly imageLoadTimeoutMs: number;
  private readonly permissionTimeoutMs: number;
  private readonly contextTimeoutMs: number;
  private readonly queue: CaptureQueue;
  private readonly debugCapture = new CaptureDebugger();
  private readonly jobs = new Map<string, RuntimeCaptureJob>();
  private appView: AppView = "camera";
  private sequence = 0;
  private lastContext: AntiCameraContext | null = null;
  private sourceCaptureReservations = 0;

  constructor(
    private readonly appShell: HTMLElement,
    private readonly cameraView: HTMLElement,
    private readonly filmView: HTMLElement,
    private readonly viewToggle: HTMLButtonElement,
    private readonly viewfinder: HTMLElement,
    private readonly cameraSwitch: HTMLButtonElement,
    private readonly debugPanel: HTMLElement,
    private readonly readout: HTMLElement,
    private readonly analyzingLayer: HTMLElement,
    private readonly instantReveal: HTMLElement,
    private readonly latestFrame: HTMLImageElement,
    private readonly batteryFill: HTMLElement,
    private readonly batteryLabel: HTMLElement,
    private readonly shutter: HTMLButtonElement,
    private readonly modeInputs: NodeListOf<HTMLInputElement>,
    private readonly manualControls: ManualControls,
    private readonly gallery: Gallery,
    dependencies: AntiCameraAppDependencies = {}
  ) {
    this.context = dependencies.context ?? new ContextCollector();
    this.liveCamera = dependencies.liveCamera ?? new LiveCamera(document.getElementById("camera-preview") as HTMLVideoElement);
    this.faceAnalyzer = dependencies.faceAnalyzer ?? new BrowserFaceAnalyzer();
    this.objectAnalyzer = dependencies.objectAnalyzer ?? new LocalCnnObjectAnalyzer();
    this.overlayRenderer = dependencies.overlayRenderer ?? new SemanticOverlayRenderer();
    this.shutterSound = dependencies.shutterSound ?? new ShutterSound();
    this.captureDelay = dependencies.delay ?? delay;
    this.minimumAnalyzingTime = dependencies.minimumAnalyzingTime ?? (() => 650 + Math.round(Math.random() * 550));
    this.imageLoadTimeoutMs = dependencies.imageLoadTimeoutMs ?? IMAGE_LOAD_TIMEOUT_MS;
    this.permissionTimeoutMs = dependencies.permissionTimeoutMs ?? PERMISSION_TIMEOUT_MS;
    this.contextTimeoutMs = dependencies.contextTimeoutMs ?? CONTEXT_TIMEOUT_MS;
    this.queue = new CaptureQueue({
      maxConcurrent: dependencies.maxConcurrentAnalyses ?? MAX_CONCURRENT_ANALYSES,
      maxQueuedCaptures: dependencies.maxQueuedCaptures ?? MAX_QUEUED_CAPTURES,
      run: (job) => this.runQueuedJob(job),
      onStatus: (job) => this.handleJobStatus(job),
      onChange: () => this.updateQueueStatus()
    });
  }

  async start(): Promise<void> {
    await this.gallery.load().catch((error) => this.debugCapture.log("capture:gallery-load-error", { error: safeError(error) }));
    await this.context.startPassiveCollection().catch((error) => this.debugCapture.log("capture:passive-context-error", { error: safeError(error) }));
    this.shutter.addEventListener("click", () => {
      this.capture();
    });
    this.viewfinder.addEventListener("click", () => {
      void this.liveCamera.start().catch((error) => this.debugCapture.log("capture:camera-start-error", { error: safeError(error) }));
      this.setDebugPanelOpen(!this.isDebugPanelOpen());
    });
    this.cameraSwitch.addEventListener("click", () => {
      void this.switchCamera();
    });
    this.viewToggle.addEventListener("click", () => {
      this.setAppView(this.appView === "camera" ? "film" : "camera");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.setDebugPanelOpen(false);
      }
    });
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (
        this.isDebugPanelOpen()
        && target instanceof Element
        && !this.debugPanel.contains(target)
        && !this.viewfinder.contains(target)
      ) {
        this.setDebugPanelOpen(false);
      }
    });
    this.manualControls.onChange(() => {
      void this.refreshReadout();
    });
    this.gallery.onRetry((id) => this.retryJob(id));

    await this.refreshReadout();
    this.setAppView("camera");
    this.updateCameraSwitch();
    this.updateQueueStatus();
    window.setInterval(() => {
      void this.refreshReadout();
    }, 1_500);
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

  private capture(): void {
    void this.captureFromShutter();
  }

  private async captureFromShutter(): Promise<void> {
    if (!this.hasCaptureCapacity()) {
      this.showBufferFull();
      return;
    }

    const frozenPose = this.context.freezeCameraPose();
    const frozenSettings = this.manualControls.freezeSettings();
    const mode = this.mode();
    const id = createFrameId();
    const sequence = this.sequence;
    this.sequence += 1;
    const createdAt = new Date(frozenPose.capturedAt).toISOString();

    this.playShutter();
    this.sourceCaptureReservations += 1;
    this.gallery.addPlaceholder({
      id,
      timestamp: createdAt,
      status: "capturing-source"
    });
    this.updateQueueStatus();

    let sourcePhoto: SourcePhotoReference;
    try {
      sourcePhoto = await this.liveCamera.captureStill();
    } catch (error) {
      this.sourceCaptureReservations = Math.max(0, this.sourceCaptureReservations - 1);
      this.gallery.failPlaceholder(id, safeError(error));
      this.updateQueueStatus();
      return;
    }
    this.sourceCaptureReservations = Math.max(0, this.sourceCaptureReservations - 1);

    if (!this.queue.hasCapacity()) {
      this.showBufferFull();
      this.gallery.failPlaceholder(id, "Film buffer full");
      return;
    }

    const job = this.createJob(id, sequence, frozenPose, frozenSettings, mode, sourcePhoto);
    this.jobs.set(job.id, job);
    this.gallery.updatePlaceholder(job.id, { status: "queued" });

    if (!this.queue.enqueue(job)) {
      this.gallery.failPlaceholder(job.id, "Film buffer full");
      this.showBufferFull();
    }
  }

  private mode(): IndoorOutdoor {
    const selected = [...this.modeInputs].find((input) => input.checked);
    return selected?.value === "indoor" ? "indoor" : "outdoor";
  }

  private createJob(
    id: string,
    sequence: number,
    frozenPose: RuntimeCaptureJob["frozenPose"],
    frozenSettings: RuntimeCaptureJob["frozenSettings"],
    mode: IndoorOutdoor,
    sourcePhoto: SourcePhotoReference
  ): RuntimeCaptureJob {
    const createdAt = new Date(frozenPose.capturedAt).toISOString();

    this.debugCapture.log("capture:start", { id, sequence });
    const permissionReady = withTimeout(this.context.primeFromUserGesture(), this.permissionTimeoutMs, "sensor permissions")
      .catch((error) => this.debugCapture.log("capture:permissions-error", { id, error: safeError(error) }))
      .then(() => this.debugCapture.log("capture:permissions-complete", { id }));
    const contextReady = permissionReady.then(() => withTimeout(
      this.context.snapshot(mode, frozenPose, frozenSettings, { waitForReverseGeocodeMs: 900 }),
      this.contextTimeoutMs,
      "context snapshot"
    ));

    return {
      id,
      sequence,
      createdAt,
      status: "queued",
      frozenPose,
      frozenSettings,
      mode,
      permissionReady,
      contextReady,
      minimumAnalyzingTime: this.minimumAnalyzingTime(),
      sourcePhoto
    };
  }

  private async runQueuedJob(job: CaptureJob): Promise<void> {
    const runtimeJob = this.jobs.get(job.id);
    if (!runtimeJob) {
      throw new Error("Capture job was not found");
    }

    try {
      if (!runtimeJob.sourcePhoto || runtimeJob.sourceReleased) {
        throw new Error("Source photo was released; take a new exposure");
      }

      const captureStartedAt = Date.now();
      this.queue.setStatus(runtimeJob, "collecting-context");
      const context = await runtimeJob.contextReady;
      runtimeJob.context = context;
      this.debugCapture.log("capture:context-complete", { id: runtimeJob.id, capturedAt: context.capturedAt });

      this.queue.setStatus(runtimeJob, "detecting-faces");
      const faceAnalysis = await this.faceAnalyzer.analyze(runtimeJob.sourcePhoto).catch((error): FaceAnalysis => ({
        faces: [],
        count: 0,
        provider: "face-analysis-fallback",
        warning: `Face analysis failed: ${safeError(error)}`
      }));
      runtimeJob.faceAnalysis = faceAnalysis;

      this.queue.setStatus(runtimeJob, "analyzing-objects");
      const objectAnalysis = await this.objectAnalyzer.analyze(runtimeJob.sourcePhoto, runtimeJob.frozenSettings)
        .catch((error): ObjectAnalysis => ({
          objects: [],
          relationships: [],
          provider: "local-object-analysis-fallback",
          warnings: [`Object analysis failed: ${safeError(error)}`]
        }));
      runtimeJob.objectAnalysis = objectAnalysis;

      const objectMetadata = toPersistedObjectMetadata(objectAnalysis);
      context.conCamera = {
        detectedFaceCount: faceAnalysis.count,
        faceAnalysisProvider: faceAnalysis.provider,
        ...(faceAnalysis.warning ? { faceAnalysisWarning: faceAnalysis.warning } : {}),
        overlaySettings: runtimeJob.frozenSettings,
        ...(objectMetadata.recognizedObjects.length > 0 ? { recognizedObjects: objectMetadata.recognizedObjects } : {}),
        ...(objectMetadata.objectRelationships.length > 0 ? { objectRelationships: objectMetadata.objectRelationships } : {}),
        objectAnalysisProvider: objectAnalysis.provider,
        ...(objectAnalysis.metrics ? { objectAnalysisMetrics: objectAnalysis.metrics } : {}),
        ...(objectMetadata.warnings.length > 0 ? { objectAnalysisWarnings: objectMetadata.warnings } : {}),
        ...(objectMetadata.omittedObjects && objectMetadata.omittedObjects.length > 0 ? { omittedObjects: objectMetadata.omittedObjects } : {}),
        sourceImageTransmitted: false
      };

      this.queue.setStatus(runtimeJob, "rendering-overlay");
      const renderStartedAt = Date.now();
      const rendered = await this.overlayRenderer.render({
        source: runtimeJob.sourcePhoto,
        analysis: objectAnalysis,
        settings: runtimeJob.frozenSettings,
        timestamp: context.capturedAt
      }).catch(async (error): Promise<RenderedConCameraFrame> => {
        this.debugCapture.log("capture:overlay-render-error", { id: runtimeJob.id, error: safeError(error) });
        return {
          imageDataUrl: runtimeJob.sourcePhoto?.dataUrl ?? "",
          sceneSummary: `Analysis unavailable: ${safeError(error)}`,
          renderVersion: "source-photo-fallback",
          overlayRenderMs: Math.max(0, Math.round(Date.now() - renderStartedAt)),
          renderedObjects: [],
          renderedRelationships: []
        };
      });
      runtimeJob.renderedFrame = rendered;

      const metrics = context.conCamera.objectAnalysisMetrics;
      if (metrics) {
        metrics.overlayRenderMs = rendered.overlayRenderMs;
        metrics.captureMs = Math.max(0, Math.round(Date.now() - captureStartedAt));
        metrics.totalMs = metrics.captureMs;
      }
      context.conCamera.sceneSummary = rendered.sceneSummary;
      context.conCamera.renderVersion = rendered.renderVersion;

      await this.captureDelay(runtimeJob.minimumAnalyzingTime);
      runtimeJob.imageDataUrl = rendered.imageDataUrl;
      runtimeJob.provider = "local-semantic-overlay";

      const frame: AntiCameraFrame = {
        id: runtimeJob.id,
        timestamp: context.capturedAt,
        imageDataUrl: rendered.imageDataUrl,
        provider: "local-semantic-overlay",
        sceneSummary: rendered.sceneSummary,
        context,
        ...(rendered.renderVersion === "source-photo-fallback" ? { analysisError: rendered.sceneSummary } : {})
      };

      this.debugCapture.log("capture:reveal-start", { id: runtimeJob.id });
      void this.reveal(frame.imageDataUrl)
        .catch((error) => this.debugCapture.log("capture:reveal-error", { id: runtimeJob.id, error: safeError(error) }));
      void this.gallery.completePlaceholder(frame)
        .then(() => this.debugCapture.log("capture:gallery-save-complete", { id: runtimeJob.id }))
        .catch((storageError) => this.reportNonFatalStorageFailure(storageError));
      void this.refreshReadout();
      this.debugCapture.log("capture:complete", { id: runtimeJob.id });
    } finally {
      if (runtimeJob.imageDataUrl) {
        this.releaseSource(runtimeJob);
      }
    }
  }

  private retryJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.status !== "error" || !this.queue.hasCapacity()) {
      if (!this.queue.hasCapacity()) {
        this.showBufferFull();
      }
      return;
    }

    if (!job.sourcePhoto || job.sourceReleased) {
      this.gallery.failPlaceholder(id, "Source photo released; take a new exposure");
      return;
    }

    job.error = undefined;
    job.status = "queued";
    job.permissionReady = Promise.resolve();
    job.contextReady = job.context
      ? Promise.resolve(job.context)
      : withTimeout(
        this.context.snapshot(job.mode, job.frozenPose, job.frozenSettings, { waitForReverseGeocodeMs: 900 }),
        this.contextTimeoutMs,
        "context snapshot"
      );
    this.gallery.updatePlaceholder(id, { status: "queued", error: undefined });
    this.playShutter();
    this.queue.enqueue(job);
  }

  private handleJobStatus(job: CaptureJob): void {
    if (job.status === "error") {
      this.gallery.failPlaceholder(job.id, job.error ?? "Exposure failed");
    } else if (job.status !== "complete") {
      this.gallery.updatePlaceholder(job.id, { status: job.status });
    }
    this.updateQueueStatus();
  }

  private updateQueueStatus(): void {
    const count = this.queue.inFlightCount + this.sourceCaptureReservations;
    this.shutter.disabled = !this.hasCaptureCapacity();
    this.analyzingLayer.classList.remove("hidden");
    this.viewfinder.classList.toggle("is-developing", count > 0);

    if (!this.hasCaptureCapacity()) {
      this.analyzingLayer.textContent = "FILM BUFFER FULL";
    } else if (count === 0) {
      this.analyzingLayer.textContent = "READY";
    } else if (count === 1) {
      this.analyzingLayer.textContent = "1 ANALYZING";
    } else {
      this.analyzingLayer.textContent = `${count} IN BUFFER`;
    }
  }

  private playShutter(): void {
    try {
      this.shutterSound.play();
      navigator.vibrate?.(20);
    } catch (error) {
      this.debugCapture.log("capture:shutter-sound-error", { error: safeError(error) });
    }
  }

  private async switchCamera(): Promise<void> {
    this.cameraSwitch.disabled = true;
    this.cameraSwitch.classList.add("is-switching");
    try {
      await this.liveCamera.toggleCamera();
      this.debugCapture.log("capture:camera-switched", { facing: this.liveCamera.currentFacingMode() });
    } catch (error) {
      this.debugCapture.log("capture:camera-switch-error", { error: safeError(error) });
      this.analyzingLayer.textContent = safeError(error).toUpperCase();
      this.analyzingLayer.classList.remove("hidden");
    } finally {
      this.cameraSwitch.disabled = false;
      this.cameraSwitch.classList.remove("is-switching");
      this.updateCameraSwitch();
    }
  }

  private updateCameraSwitch(): void {
    const facing = this.liveCamera.currentFacingMode();
    this.cameraSwitch.dataset.cameraFacing = facing;
    this.cameraSwitch.setAttribute("aria-pressed", String(facing === "user"));
    this.cameraSwitch.setAttribute(
      "aria-label",
      facing === "environment" ? "Switch to front camera" : "Switch to rear camera"
    );
  }

  private showBufferFull(): void {
    this.analyzingLayer.textContent = "FILM BUFFER FULL";
    this.analyzingLayer.classList.remove("hidden");
    this.shutter.disabled = true;
  }

  private hasCaptureCapacity(): boolean {
    return this.queue.inFlightCount + this.sourceCaptureReservations < this.queue.maxQueuedCaptures;
  }

  private reportNonFatalStorageFailure(error: unknown): void {
    this.debugCapture.log("capture:gallery-save-error", { error: safeError(error) });
  }

  private releaseSource(job: RuntimeCaptureJob): void {
    job.sourcePhoto = undefined;
    job.sourceReleased = true;
  }

  private async reveal(imageDataUrl: string): Promise<void> {
    await this.loadLatestFrame(imageDataUrl);
    this.latestFrame.classList.add("hidden");
    this.instantReveal.classList.add("hidden");
  }

  private setAppView(view: AppView): void {
    this.appView = view;
    this.appShell.dataset.view = view;
    this.cameraView.setAttribute("aria-hidden", String(view !== "camera"));
    this.filmView.setAttribute("aria-hidden", String(view !== "film"));
    this.viewToggle.setAttribute("aria-label", view === "camera" ? "Open film roll" : "Return to camera");
    this.viewToggle.setAttribute("aria-pressed", String(view === "film"));
    this.viewToggle.classList.toggle("is-film-view", view === "film");

    setInert(this.cameraView, view !== "camera");
    setInert(this.filmView, view !== "film");
    if (view === "film") {
      this.setDebugPanelOpen(false);
    }
  }

  private isDebugPanelOpen(): boolean {
    return !this.debugPanel.hidden;
  }

  private setDebugPanelOpen(open: boolean): void {
    this.debugPanel.hidden = !open;
    this.debugPanel.classList.toggle("hidden", !open);
    this.viewfinder.setAttribute("aria-expanded", String(open));
    this.viewfinder.setAttribute(
      "aria-label",
      open ? "Close camera context information" : "Open camera context information"
    );
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
        reject(new Error("Rendered overlay image failed to load"));
      };

      this.latestFrame.onload = complete;
      this.latestFrame.onerror = fail;
      timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(new Error("Rendered overlay image load timed out"));
      }, this.imageLoadTimeoutMs);
      this.latestFrame.src = imageDataUrl;

      if (this.latestFrame.complete && this.latestFrame.naturalWidth > 0) {
        complete();
      }
    });
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function setInert(element: HTMLElement, inert: boolean): void {
  (element as HTMLElement & { inert?: boolean }).inert = inert;
}

class CaptureDebugger {
  private readonly enabled = debugCaptureEnabled();
  private readonly startedAt = Date.now();

  log(stage: string, detail: Record<string, unknown> = {}): void {
    if (!this.enabled) {
      return;
    }

    console.debug("[con-camera]", stage, {
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
