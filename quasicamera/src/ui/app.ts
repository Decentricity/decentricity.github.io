import type {
  AntiCameraContext,
  AntiCameraFrame,
  DetectedFace,
  FaceAnalysis,
  IndoorOutdoor,
  ObjectAnalysis,
  SourcePhotoReference,
  SubjectFaceSelection
} from "../types.js";
import { CaptureQueue, type CaptureJob } from "../capture/captureQueue.js";
import { LiveCamera } from "../camera/liveCamera.js";
import { ContextCollector } from "../context/contextCollector.js";
import { BrowserFaceAnalyzer, type FaceAnalyzer } from "../faces/faceAnalyzer.js";
import { createFaceCrops, type FaceCrop } from "../faces/faceCrops.js";
import { selectFacesForSubjectMode } from "../faces/faceSelection.js";
import { OpenAIObjectAnalyzer, type ObjectAnalyzer } from "../objects/objectAnalyzer.js";
import { toPersistedObjectMetadata } from "../objects/objectNormalization.js";
import { Gallery } from "../gallery/gallery.js";
import { ImageGenerator } from "../image/imageGenerator.js";
import { PromptBuilder } from "../promptBuilder.js";
import { ManualControls } from "./manualControls.js";
import { renderBattery, renderReadout } from "./readout.js";
import { ShutterSound } from "./shutterSound.js";

const PERMISSION_TIMEOUT_MS = 8_000;
const CONTEXT_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 300_000;
const IMAGE_LOAD_TIMEOUT_MS = 15_000;
const OPENAI_PROVIDER_SETTLE_DELAY_MS = 4_000;
const RATE_LIMIT_SETTLE_DELAY_MS = 15_000;
const GENERATION_RETRY_DELAYS_MS = [8_000, 20_000] as const;
const MAX_CONCURRENT_GENERATIONS = 1;
const MAX_QUEUED_CAPTURES = 10;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

type CaptureContext = Pick<ContextCollector, "startPassiveCollection" | "primeFromUserGesture" | "freezeCameraPose" | "snapshot">;
type CapturePromptBuilder = {
  build(context: AntiCameraContext, faceSelection?: SubjectFaceSelection, objectAnalysis?: ObjectAnalysis): string;
};
type CaptureImageGenerator = Pick<ImageGenerator, "canGenerate" | "generate" | "saveUserKey"> & {
  providerId?: () => string;
};
type CaptureDelay = (ms: number) => Promise<void>;
type CaptureFaceCropper = (source: SourcePhotoReference, faces: DetectedFace[]) => Promise<FaceCrop[]>;
type CaptureLiveCamera = Pick<LiveCamera, "start" | "captureStill" | "currentStatus" | "toggleCamera" | "currentFacingMode">;
type AppView = "camera" | "film";

interface AntiCameraAppDependencies {
  context?: CaptureContext;
  promptBuilder?: CapturePromptBuilder;
  imageGenerator?: CaptureImageGenerator;
  liveCamera?: CaptureLiveCamera;
  faceAnalyzer?: FaceAnalyzer;
  objectAnalyzer?: ObjectAnalyzer;
  faceCropper?: CaptureFaceCropper;
  shutterSound?: Pick<ShutterSound, "play">;
  delay?: CaptureDelay;
  minimumDevelopingTime?: () => number;
  imageLoadTimeoutMs?: number;
  permissionTimeoutMs?: number;
  contextTimeoutMs?: number;
  generationTimeoutMs?: number;
  providerSettleDelayMs?: number;
  rateLimitSettleDelayMs?: number;
  generationRetryDelaysMs?: readonly number[];
  maxConcurrentGenerations?: number;
  maxQueuedCaptures?: number;
}

interface RuntimeCaptureJob extends CaptureJob {
  permissionReady: Promise<void>;
  contextReady: Promise<AntiCameraContext>;
  minimumDevelopingTime: number;
  sourcePhoto?: SourcePhotoReference | undefined;
  faceAnalysis?: FaceAnalysis | undefined;
  faceSelection?: SubjectFaceSelection | undefined;
  faceCrops?: FaceCrop[] | undefined;
  objectAnalysis?: ObjectAnalysis | undefined;
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
  private readonly promptBuilder: CapturePromptBuilder;
  private readonly imageGenerator: CaptureImageGenerator;
  private readonly liveCamera: CaptureLiveCamera;
  private readonly faceAnalyzer: FaceAnalyzer;
  private readonly objectAnalyzer: ObjectAnalyzer;
  private readonly faceCropper: CaptureFaceCropper;
  private readonly shutterSound: Pick<ShutterSound, "play">;
  private readonly captureDelay: CaptureDelay;
  private readonly minimumDevelopingTime: () => number;
  private readonly imageLoadTimeoutMs: number;
  private readonly permissionTimeoutMs: number;
  private readonly contextTimeoutMs: number;
  private readonly generationTimeoutMs: number;
  private readonly providerSettleDelayMs: number;
  private readonly rateLimitSettleDelayMs: number;
  private readonly generationRetryDelaysMs: readonly number[];
  private readonly queue: CaptureQueue;
  private readonly debugCapture = new CaptureDebugger();
  private readonly jobs = new Map<string, RuntimeCaptureJob>();
  private appView: AppView = "camera";
  private sequence = 0;
  private lastContext: Awaited<ReturnType<ContextCollector["snapshot"]>> | null = null;

  constructor(
    private readonly appShell: HTMLElement,
    private readonly cameraView: HTMLElement,
    private readonly filmView: HTMLElement,
    private readonly viewToggle: HTMLButtonElement,
    private readonly viewfinder: HTMLElement,
    private readonly cameraSwitch: HTMLButtonElement,
    private readonly debugPanel: HTMLElement,
    private readonly readout: HTMLElement,
    private readonly developingLayer: HTMLElement,
    private readonly instantReveal: HTMLElement,
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
    this.liveCamera = dependencies.liveCamera ?? new LiveCamera(document.getElementById("camera-preview") as HTMLVideoElement);
    this.faceAnalyzer = dependencies.faceAnalyzer ?? new BrowserFaceAnalyzer();
    this.objectAnalyzer = dependencies.objectAnalyzer ?? new OpenAIObjectAnalyzer();
    this.faceCropper = dependencies.faceCropper ?? createFaceCrops;
    this.shutterSound = dependencies.shutterSound ?? new ShutterSound();
    this.captureDelay = dependencies.delay ?? delay;
    this.minimumDevelopingTime = dependencies.minimumDevelopingTime ?? (() => 2600 + Math.round(Math.random() * 1800));
    this.imageLoadTimeoutMs = dependencies.imageLoadTimeoutMs ?? IMAGE_LOAD_TIMEOUT_MS;
    this.permissionTimeoutMs = dependencies.permissionTimeoutMs ?? PERMISSION_TIMEOUT_MS;
    this.contextTimeoutMs = dependencies.contextTimeoutMs ?? CONTEXT_TIMEOUT_MS;
    this.generationTimeoutMs = dependencies.generationTimeoutMs ?? GENERATION_TIMEOUT_MS;
    this.providerSettleDelayMs = dependencies.providerSettleDelayMs ?? OPENAI_PROVIDER_SETTLE_DELAY_MS;
    this.rateLimitSettleDelayMs = dependencies.rateLimitSettleDelayMs ?? RATE_LIMIT_SETTLE_DELAY_MS;
    this.generationRetryDelaysMs = dependencies.generationRetryDelaysMs ?? GENERATION_RETRY_DELAYS_MS;
    this.queue = new CaptureQueue({
      maxConcurrent: dependencies.maxConcurrentGenerations ?? MAX_CONCURRENT_GENERATIONS,
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
    this.keyPanel.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveKey();
    });
    this.manualControls.onChange(() => {
      if (this.keyPanel.classList.contains("hidden")) {
        void this.refreshReadout();
      }
    });
    this.gallery.onRetry((id) => this.retryJob(id));

    await this.refreshReadout();
    this.setAppView("camera");
    this.updateCameraSwitch();
    if (!this.imageGenerator.canGenerate()) {
      this.showKeyPanel();
    }
    this.updateQueueStatus();
    window.setInterval(() => {
      if (this.latestFrame.classList.contains("hidden") && this.keyPanel.classList.contains("hidden")) {
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

  private capture(): void {
    void this.captureFromShutter();
  }

  private async captureFromShutter(): Promise<void> {
    if (!this.imageGenerator.canGenerate()) {
      this.showKeyPanel();
      return;
    }

    if (!this.queue.hasCapacity()) {
      this.showBufferFull();
      return;
    }

    const frozenPose = this.context.freezeCameraPose();
    const frozenSettings = this.manualControls.freezeSettings();
    const mode = this.mode();
    const id = createFrameId();
    const sequence = this.sequence;
    this.sequence += 1;

    this.playShutter();

    let sourcePhoto: SourcePhotoReference;
    try {
      sourcePhoto = await this.liveCamera.captureStill();
    } catch (error) {
      this.developingLayer.textContent = safeError(error).toUpperCase();
      this.developingLayer.classList.remove("hidden");
      return;
    }

    if (!this.queue.hasCapacity()) {
      this.showBufferFull();
      return;
    }

    const job = this.createJob(id, sequence, frozenPose, frozenSettings, mode, sourcePhoto);
    this.jobs.set(job.id, job);
    this.gallery.addPlaceholder({
      id: job.id,
      timestamp: job.createdAt,
      status: "queued"
    });

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
    this.debugCapture.log("capture:permissions-start", { id });
    const permissionReady = withTimeout(this.context.primeFromUserGesture(), this.permissionTimeoutMs, "sensor permissions")
      .catch((error) => this.debugCapture.log("capture:permissions-error", { id, error: safeError(error) }))
      .then(() => {
        this.debugCapture.log("capture:permissions-complete", { id });
      });
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
      minimumDevelopingTime: this.minimumDevelopingTime(),
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

      this.queue.setStatus(runtimeJob, "collecting-context");
      const context = await runtimeJob.contextReady;
      runtimeJob.context = context;
      this.debugCapture.log("capture:context-complete", { id: runtimeJob.id, capturedAt: context.capturedAt });

      this.queue.setStatus(runtimeJob, "detecting-faces");
      const analysis = await this.faceAnalyzer.analyze(runtimeJob.sourcePhoto);
      runtimeJob.faceAnalysis = analysis;
      this.debugCapture.log("capture:faces-complete", { id: runtimeJob.id, count: analysis.count, provider: analysis.provider });

      this.queue.setStatus(runtimeJob, "selecting-faces");
      const selection = selectFacesForSubjectMode(analysis.faces, runtimeJob.frozenSettings.subjectMode, runtimeJob.id);
      runtimeJob.faceSelection = selection;
      let faceCrops: FaceCrop[] = [];
      let cropWarning: string | undefined;
      try {
        faceCrops = await this.faceCropper(runtimeJob.sourcePhoto, selection.selectedFaces);
      } catch (error) {
        cropWarning = safeError(error);
        this.debugCapture.log("capture:face-crop-error", { id: runtimeJob.id, error: cropWarning });
      }
      runtimeJob.faceCrops = faceCrops;

      this.queue.setStatus(runtimeJob, "analyzing-objects");
      const objectAnalysis = await this.objectAnalyzer.analyze(runtimeJob.sourcePhoto)
        .catch((error): ObjectAnalysis => ({
          objects: [],
          relationships: [],
          provider: "object-analysis-fallback",
          warnings: [`Object analysis failed: ${safeError(error)}`]
        }));
      runtimeJob.objectAnalysis = objectAnalysis;
      this.debugCapture.log("capture:objects-complete", {
        id: runtimeJob.id,
        count: objectAnalysis.objects.length,
        relationships: objectAnalysis.relationships.length,
        provider: objectAnalysis.provider
      });

      const objectMetadata = toPersistedObjectMetadata(objectAnalysis);
      const analysisWarning = analysis.warning ?? cropWarning;
      context.quasiCamera = {
        detectedFaceCount: analysis.count,
        selectedFaceCount: selection.selectedFaceCount,
        selectedFaceIds: selection.selectedFaceIds,
        subjectMappingStrategy: selection.strategy,
        faceAnalysisProvider: analysis.provider,
        ...(analysisWarning ? { faceAnalysisWarning: analysisWarning } : {}),
        ...(objectMetadata.recognizedObjects.length > 0 ? { recognizedObjects: objectMetadata.recognizedObjects } : {}),
        ...(objectMetadata.objectRelationships.length > 0 ? { objectRelationships: objectMetadata.objectRelationships } : {}),
        objectAnalysisProvider: objectAnalysis.provider,
        ...(objectMetadata.warnings.length > 0 ? { objectAnalysisWarnings: objectMetadata.warnings } : {}),
        ...(objectMetadata.omittedObjects && objectMetadata.omittedObjects.length > 0 ? { omittedObjects: objectMetadata.omittedObjects } : {})
      };

      const prompt = this.promptBuilder.build(context, selection, objectAnalysis);
      runtimeJob.prompt = prompt;
      this.debugCapture.log("capture:prompt-complete", { id: runtimeJob.id, promptLength: prompt.length });
      this.debugCapture.log("capture:provider-selected", { id: runtimeJob.id, provider: this.imageGenerator.providerId?.() ?? "unknown" });

      const settleDelay = this.providerSettleDelayFor(objectAnalysis);
      if (settleDelay > 0) {
        this.debugCapture.log("capture:provider-cooldown", { id: runtimeJob.id, delayMs: settleDelay });
        await this.captureDelay(settleDelay);
      }

      this.queue.setStatus(runtimeJob, "generating");
      this.debugCapture.log("capture:request-start", { id: runtimeJob.id });
      const generationRequest = {
        context,
        prompt,
        sourceImage: {
          dataUrl: runtimeJob.sourcePhoto.dataUrl,
          role: "source" as const,
          name: "source-photo.jpg"
        },
        faceReferences: faceCrops.map((crop) => crop.image),
        inputFidelity: "high" as const
      };
      const [result] = await Promise.all([
        withTimeout(this.generateWithBackoff(generationRequest, runtimeJob.id), this.generationTimeoutMs, "image generation"),
        this.captureDelay(runtimeJob.minimumDevelopingTime)
      ]);
      runtimeJob.imageDataUrl = result.imageDataUrl;
      runtimeJob.provider = result.provider;
      this.debugCapture.log("capture:request-response", { id: runtimeJob.id, provider: result.provider });

      const frame: AntiCameraFrame = {
        id: runtimeJob.id,
        timestamp: context.capturedAt,
        imageDataUrl: result.imageDataUrl,
        provider: result.provider,
        prompt,
        context,
        generationError: result.fallbackReason
      };

      this.queue.setStatus(runtimeJob, "developing");
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
      if (isAuthenticationError(job.error ?? "")) {
        this.showKeyPanel(job.error ?? "USER KEY REQUIRED");
      }
    } else if (job.status !== "complete") {
      this.gallery.updatePlaceholder(job.id, { status: job.status });
    }
    this.updateQueueStatus();
  }

  private updateQueueStatus(): void {
    const count = this.queue.inFlightCount;
    this.shutter.disabled = !this.queue.hasCapacity();
    this.developingLayer.classList.remove("hidden");
    this.viewfinder.classList.toggle("is-developing", count > 0);

    if (!this.queue.hasCapacity()) {
      this.developingLayer.textContent = "FILM BUFFER FULL";
    } else if (count === 0) {
      this.developingLayer.textContent = "READY";
    } else if (count === 1) {
      this.developingLayer.textContent = "1 DEVELOPING";
    } else {
      this.developingLayer.textContent = `${count} IN BUFFER`;
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
      this.developingLayer.textContent = safeError(error).toUpperCase();
      this.developingLayer.classList.remove("hidden");
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
    this.developingLayer.textContent = "FILM BUFFER FULL";
    this.developingLayer.classList.remove("hidden");
    this.shutter.disabled = true;
  }

  private showKeyPanel(message = "USER KEY REQUIRED"): void {
    this.setAppView("camera");
    this.viewfinder.classList.remove("is-developing");
    this.viewfinder.classList.remove("needs-key");
    this.viewfinder.classList.add("needs-key");
    this.developingLayer.textContent = "KEY REQUIRED";
    this.developingLayer.classList.remove("hidden");
    this.instantReveal.classList.add("hidden");
    this.latestFrame.classList.add("hidden");
    this.keyPanel.classList.remove("hidden");
    this.keyMessage.textContent = message.toUpperCase();
    this.setDebugPanelOpen(true);
    this.keyInput.focus();
  }

  private reportNonFatalStorageFailure(error: unknown): void {
    this.debugCapture.log("capture:gallery-save-error", { error: safeError(error) });
  }

  private providerSettleDelayFor(objectAnalysis: ObjectAnalysis): number {
    const objectProvider = objectAnalysis.provider.toLowerCase();
    const imageProvider = (this.imageGenerator.providerId?.() ?? "").toLowerCase();
    const objectWasRateLimited = objectAnalysis.warnings.some((warning) => isRateLimitOrContentionError(warning));

    if (objectWasRateLimited) {
      return this.rateLimitSettleDelayMs;
    }

    if (objectProvider.startsWith("openai-") && imageProvider.includes("openai")) {
      return this.providerSettleDelayMs;
    }

    return 0;
  }

  private async generateWithBackoff(
    request: Parameters<CaptureImageGenerator["generate"]>[0],
    jobId: string
  ): Promise<Awaited<ReturnType<CaptureImageGenerator["generate"]>>> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.imageGenerator.generate(request);
      } catch (error) {
        const retryDelay = this.generationRetryDelaysMs[attempt];
        if (retryDelay === undefined || !isRateLimitOrContentionError(error)) {
          throw error;
        }

        this.debugCapture.log("capture:generation-backoff", {
          id: jobId,
          attempt: attempt + 1,
          delayMs: retryDelay,
          error: safeError(error)
        });
        await this.captureDelay(retryDelay);
      }
    }
  }

  private releaseSource(job: RuntimeCaptureJob): void {
    job.sourcePhoto = undefined;
    job.faceCrops = undefined;
    job.sourceReleased = true;
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

    const cameraInert = view !== "camera";
    const filmInert = view !== "film";
    setInert(this.cameraView, cameraInert);
    setInert(this.filmView, filmInert);
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

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRateLimitOrContentionError(error: unknown): boolean {
  const message = safeError(error).toLowerCase();
  return /\b429\b|rate limit|too many requests|quota exceeded|temporarily unavailable|overloaded|server busy|contention|\b5(?:00|02|03|04)\b/.test(message);
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

    console.debug("[quasi-camera]", stage, {
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
