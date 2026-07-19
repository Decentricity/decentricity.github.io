import { CaptureQueue } from "../capture/captureQueue.js";
import { LiveCamera } from "../camera/liveCamera.js";
import { ContextCollector } from "../context/contextCollector.js";
import { BrowserFaceAnalyzer } from "../faces/faceAnalyzer.js";
import { createFaceCrops } from "../faces/faceCrops.js";
import { selectFacesForSubjectMode } from "../faces/faceSelection.js";
import { OpenAIObjectAnalyzer } from "../objects/objectAnalyzer.js";
import { toPersistedObjectMetadata } from "../objects/objectNormalization.js";
import { ImageGenerator } from "../image/imageGenerator.js";
import { PromptBuilder } from "../promptBuilder.js";
import { renderBattery, renderReadout } from "./readout.js";
import { ShutterSound } from "./shutterSound.js";
const PERMISSION_TIMEOUT_MS = 8_000;
const CONTEXT_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 300_000;
const IMAGE_LOAD_TIMEOUT_MS = 15_000;
const OPENAI_PROVIDER_SETTLE_DELAY_MS = 4_000;
const RATE_LIMIT_SETTLE_DELAY_MS = 15_000;
const GENERATION_RETRY_DELAYS_MS = [8_000, 20_000];
const MAX_CONCURRENT_GENERATIONS = 1;
const MAX_QUEUED_CAPTURES = 10;
const GROUNDING_METRICS_STORAGE_KEY = "quasicamera.groundingMetrics.v1";
function delay(ms) {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = globalThis.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timeoutId !== undefined) {
            globalThis.clearTimeout(timeoutId);
        }
    });
}
function createFrameId() {
    return globalThis.crypto?.randomUUID?.() ?? `frame-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
export class AntiCameraApp {
    appShell;
    cameraView;
    filmView;
    viewToggle;
    viewfinder;
    cameraSwitch;
    debugPanel;
    readout;
    developingLayer;
    instantReveal;
    latestFrame;
    keyPanel;
    keyInput;
    keyMessage;
    batteryFill;
    batteryLabel;
    shutter;
    modeInputs;
    manualControls;
    gallery;
    context;
    promptBuilder;
    imageGenerator;
    liveCamera;
    faceAnalyzer;
    objectAnalyzer;
    faceCropper;
    shutterSound;
    captureDelay;
    minimumDevelopingTime;
    imageLoadTimeoutMs;
    permissionTimeoutMs;
    contextTimeoutMs;
    generationTimeoutMs;
    providerSettleDelayMs;
    rateLimitSettleDelayMs;
    generationRetryDelaysMs;
    queue;
    debugCapture = new CaptureDebugger();
    jobs = new Map();
    appView = "camera";
    sequence = 0;
    lastContext = null;
    constructor(appShell, cameraView, filmView, viewToggle, viewfinder, cameraSwitch, debugPanel, readout, developingLayer, instantReveal, latestFrame, keyPanel, keyInput, keyMessage, batteryFill, batteryLabel, shutter, modeInputs, manualControls, gallery, dependencies = {}) {
        this.appShell = appShell;
        this.cameraView = cameraView;
        this.filmView = filmView;
        this.viewToggle = viewToggle;
        this.viewfinder = viewfinder;
        this.cameraSwitch = cameraSwitch;
        this.debugPanel = debugPanel;
        this.readout = readout;
        this.developingLayer = developingLayer;
        this.instantReveal = instantReveal;
        this.latestFrame = latestFrame;
        this.keyPanel = keyPanel;
        this.keyInput = keyInput;
        this.keyMessage = keyMessage;
        this.batteryFill = batteryFill;
        this.batteryLabel = batteryLabel;
        this.shutter = shutter;
        this.modeInputs = modeInputs;
        this.manualControls = manualControls;
        this.gallery = gallery;
        this.context = dependencies.context ?? new ContextCollector();
        this.promptBuilder = dependencies.promptBuilder ?? new PromptBuilder();
        this.imageGenerator = dependencies.imageGenerator ?? new ImageGenerator();
        this.liveCamera = dependencies.liveCamera ?? new LiveCamera(document.getElementById("camera-preview"));
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
    async start() {
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
            if (this.isDebugPanelOpen()
                && target instanceof Element
                && !this.debugPanel.contains(target)
                && !this.viewfinder.contains(target)) {
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
    async refreshReadout() {
        try {
            this.lastContext = await withTimeout(this.context.snapshot(this.mode(), undefined, this.manualControls.currentSettings()), this.contextTimeoutMs, "context refresh");
            renderReadout(this.readout, this.lastContext);
            renderBattery(this.batteryFill, this.batteryLabel, this.lastContext);
        }
        catch (error) {
            this.debugCapture.log("capture:readout-error", { error: safeError(error) });
        }
    }
    capture() {
        void this.captureFromShutter();
    }
    async captureFromShutter() {
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
        let sourcePhoto;
        try {
            sourcePhoto = await this.liveCamera.captureStill();
        }
        catch (error) {
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
    mode() {
        const selected = [...this.modeInputs].find((input) => input.checked);
        return selected?.value === "indoor" ? "indoor" : "outdoor";
    }
    createJob(id, sequence, frozenPose, frozenSettings, mode, sourcePhoto) {
        const createdAt = new Date(frozenPose.capturedAt).toISOString();
        this.debugCapture.log("capture:start", { id, sequence });
        this.debugCapture.log("capture:permissions-start", { id });
        const permissionReady = withTimeout(this.context.primeFromUserGesture(), this.permissionTimeoutMs, "sensor permissions")
            .catch((error) => this.debugCapture.log("capture:permissions-error", { id, error: safeError(error) }))
            .then(() => {
            this.debugCapture.log("capture:permissions-complete", { id });
        });
        const contextReady = permissionReady.then(() => withTimeout(this.context.snapshot(mode, frozenPose, frozenSettings, { waitForReverseGeocodeMs: 900 }), this.contextTimeoutMs, "context snapshot"));
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
    async runQueuedJob(job) {
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
            let faceCrops = [];
            let cropWarning;
            try {
                faceCrops = await this.faceCropper(runtimeJob.sourcePhoto, selection.selectedFaces);
            }
            catch (error) {
                cropWarning = safeError(error);
                this.debugCapture.log("capture:face-crop-error", { id: runtimeJob.id, error: cropWarning });
            }
            runtimeJob.faceCrops = faceCrops;
            this.queue.setStatus(runtimeJob, "analyzing-objects");
            const objectAnalysis = await this.objectAnalyzer.analyze(runtimeJob.sourcePhoto)
                .catch((error) => ({
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
            const sourceImageAttached = runtimeJob.frozenSettings.groundingMode === "grounded";
            context.quasiCamera = {
                detectedFaceCount: analysis.count,
                selectedFaceCount: selection.selectedFaceCount,
                selectedFaceIds: selection.selectedFaceIds,
                subjectMappingStrategy: selection.strategy,
                faceAnalysisProvider: analysis.provider,
                ...(analysisWarning ? { faceAnalysisWarning: analysisWarning } : {}),
                groundingMode: runtimeJob.frozenSettings.groundingMode,
                sourceImageAttached,
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
            const generationRequest = this.buildGenerationRequest(runtimeJob, context, prompt, faceCrops);
            this.debugCapture.log("capture:request-start", {
                id: runtimeJob.id,
                grounding: runtimeJob.frozenSettings.groundingMode,
                sourceImageAttached: Boolean(generationRequest.sourceImage),
                faceReferences: generationRequest.faceReferences?.length ?? 0
            });
            const generationStartedAt = Date.now();
            const generation = withTimeout(this.generateWithBackoff(generationRequest, runtimeJob.id), this.generationTimeoutMs, "image generation")
                .then((result) => {
                recordGroundingGenerationMetric(runtimeJob.frozenSettings.groundingMode, Date.now() - generationStartedAt, true);
                return result;
            }, (error) => {
                recordGroundingGenerationMetric(runtimeJob.frozenSettings.groundingMode, Date.now() - generationStartedAt, false);
                throw error;
            });
            const [result] = await Promise.all([
                generation,
                this.captureDelay(runtimeJob.minimumDevelopingTime)
            ]);
            runtimeJob.imageDataUrl = result.imageDataUrl;
            runtimeJob.provider = result.provider;
            this.debugCapture.log("capture:request-response", { id: runtimeJob.id, provider: result.provider });
            const frame = {
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
        }
        finally {
            if (runtimeJob.imageDataUrl) {
                this.releaseSource(runtimeJob);
            }
        }
    }
    retryJob(id) {
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
            : withTimeout(this.context.snapshot(job.mode, job.frozenPose, job.frozenSettings, { waitForReverseGeocodeMs: 900 }), this.contextTimeoutMs, "context snapshot");
        this.gallery.updatePlaceholder(id, { status: "queued", error: undefined });
        this.playShutter();
        this.queue.enqueue(job);
    }
    handleJobStatus(job) {
        if (job.status === "error") {
            this.gallery.failPlaceholder(job.id, job.error ?? "Exposure failed");
            if (isAuthenticationError(job.error ?? "")) {
                this.showKeyPanel(job.error ?? "USER KEY REQUIRED");
            }
        }
        else if (job.status !== "complete") {
            this.gallery.updatePlaceholder(job.id, { status: job.status });
        }
        this.updateQueueStatus();
    }
    updateQueueStatus() {
        const count = this.queue.inFlightCount;
        this.shutter.disabled = !this.queue.hasCapacity();
        this.developingLayer.classList.remove("hidden");
        this.viewfinder.classList.toggle("is-developing", count > 0);
        if (!this.queue.hasCapacity()) {
            this.developingLayer.textContent = "FILM BUFFER FULL";
        }
        else if (count === 0) {
            this.developingLayer.textContent = "READY";
        }
        else if (count === 1) {
            this.developingLayer.textContent = "1 DEVELOPING";
        }
        else {
            this.developingLayer.textContent = `${count} IN BUFFER`;
        }
    }
    playShutter() {
        try {
            this.shutterSound.play();
            navigator.vibrate?.(20);
        }
        catch (error) {
            this.debugCapture.log("capture:shutter-sound-error", { error: safeError(error) });
        }
    }
    async switchCamera() {
        this.cameraSwitch.disabled = true;
        this.cameraSwitch.classList.add("is-switching");
        try {
            await this.liveCamera.toggleCamera();
            this.debugCapture.log("capture:camera-switched", { facing: this.liveCamera.currentFacingMode() });
        }
        catch (error) {
            this.debugCapture.log("capture:camera-switch-error", { error: safeError(error) });
            this.developingLayer.textContent = safeError(error).toUpperCase();
            this.developingLayer.classList.remove("hidden");
        }
        finally {
            this.cameraSwitch.disabled = false;
            this.cameraSwitch.classList.remove("is-switching");
            this.updateCameraSwitch();
        }
    }
    updateCameraSwitch() {
        const facing = this.liveCamera.currentFacingMode();
        this.cameraSwitch.dataset.cameraFacing = facing;
        this.cameraSwitch.setAttribute("aria-pressed", String(facing === "user"));
        this.cameraSwitch.setAttribute("aria-label", facing === "environment" ? "Switch to front camera" : "Switch to rear camera");
    }
    showBufferFull() {
        this.developingLayer.textContent = "FILM BUFFER FULL";
        this.developingLayer.classList.remove("hidden");
        this.shutter.disabled = true;
    }
    showKeyPanel(message = "USER KEY REQUIRED") {
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
    reportNonFatalStorageFailure(error) {
        this.debugCapture.log("capture:gallery-save-error", { error: safeError(error) });
    }
    buildGenerationRequest(job, context, prompt, faceCrops) {
        if (job.frozenSettings.groundingMode === "free") {
            return this.buildFreeGenerationRequest(context, prompt, faceCrops);
        }
        return this.buildGroundedGenerationRequest(job, context, prompt, faceCrops);
    }
    buildGroundedGenerationRequest(job, context, prompt, faceCrops) {
        if (!job.sourcePhoto) {
            throw new Error("Grounded generation requires a captured source photo");
        }
        return {
            context,
            prompt,
            generationGrounding: "grounded",
            sourceImage: {
                dataUrl: job.sourcePhoto.dataUrl,
                role: "source",
                name: "source-photo.jpg"
            },
            faceReferences: faceCrops.map((crop) => crop.image),
            inputFidelity: "high"
        };
    }
    buildFreeGenerationRequest(context, prompt, faceCrops) {
        return {
            context,
            prompt,
            generationGrounding: "free",
            faceReferences: faceCrops.map((crop) => crop.image),
            inputFidelity: "high"
        };
    }
    providerSettleDelayFor(objectAnalysis) {
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
    async generateWithBackoff(request, jobId) {
        for (let attempt = 0;; attempt += 1) {
            try {
                return await this.imageGenerator.generate(request);
            }
            catch (error) {
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
    releaseSource(job) {
        job.sourcePhoto = undefined;
        job.faceCrops = undefined;
        job.sourceReleased = true;
    }
    saveKey() {
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
    async reveal(imageDataUrl) {
        await this.loadLatestFrame(imageDataUrl);
        this.latestFrame.classList.add("hidden");
        this.instantReveal.classList.add("hidden");
    }
    setAppView(view) {
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
    isDebugPanelOpen() {
        return !this.debugPanel.hidden;
    }
    setDebugPanelOpen(open) {
        this.debugPanel.hidden = !open;
        this.debugPanel.classList.toggle("hidden", !open);
        this.viewfinder.setAttribute("aria-expanded", String(open));
        this.viewfinder.setAttribute("aria-label", open ? "Close camera context information" : "Open camera context information");
    }
    loadLatestFrame(imageDataUrl) {
        return new Promise((resolve, reject) => {
            let timeoutId;
            const cleanup = () => {
                if (timeoutId !== undefined) {
                    globalThis.clearTimeout(timeoutId);
                }
                this.latestFrame.onload = null;
                this.latestFrame.onerror = null;
            };
            const complete = () => {
                cleanup();
                resolve();
            };
            const fail = () => {
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
function isAuthenticationError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return /secret required|api key|authentication|unauthorized|401/i.test(message);
}
function safeError(error) {
    return error instanceof Error ? error.message : String(error);
}
function isRateLimitOrContentionError(error) {
    const message = safeError(error).toLowerCase();
    return /\b429\b|rate limit|too many requests|quota exceeded|temporarily unavailable|overloaded|server busy|contention|\b5(?:00|02|03|04)\b/.test(message);
}
function setInert(element, inert) {
    element.inert = inert;
}
class CaptureDebugger {
    enabled = debugCaptureEnabled();
    startedAt = Date.now();
    log(stage, detail = {}) {
        if (!this.enabled) {
            return;
        }
        console.debug("[quasi-camera]", stage, {
            elapsedMs: Date.now() - this.startedAt,
            ...detail
        });
    }
}
function debugCaptureEnabled() {
    if (typeof window === "undefined") {
        return false;
    }
    return new URLSearchParams(window.location.search).get("debugCapture") === "1";
}
function recordGroundingGenerationMetric(mode, latencyMs, success) {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        const metrics = readGroundingMetrics();
        const stats = metrics[mode];
        const roundedLatency = Math.max(0, Math.round(latencyMs));
        stats.attempts += 1;
        stats.successes += success ? 1 : 0;
        stats.failures += success ? 0 : 1;
        stats.totalLatencyMs += roundedLatency;
        stats.lastLatencyMs = roundedLatency;
        stats.updatedAt = new Date().toISOString();
        localStorage.setItem(GROUNDING_METRICS_STORAGE_KEY, JSON.stringify(metrics));
    }
    catch {
        // Metrics are advisory and must never affect capture.
    }
}
function readGroundingMetrics() {
    const raw = localStorage.getItem(GROUNDING_METRICS_STORAGE_KEY);
    if (!raw) {
        return defaultGroundingMetrics();
    }
    try {
        const parsed = JSON.parse(raw);
        return {
            grounded: normalizeGroundingStats(parsed.grounded),
            free: normalizeGroundingStats(parsed.free)
        };
    }
    catch {
        return defaultGroundingMetrics();
    }
}
function defaultGroundingMetrics() {
    return {
        grounded: normalizeGroundingStats(),
        free: normalizeGroundingStats()
    };
}
function normalizeGroundingStats(stats = {}) {
    return {
        attempts: nonNegativeInteger(stats.attempts),
        successes: nonNegativeInteger(stats.successes),
        failures: nonNegativeInteger(stats.failures),
        totalLatencyMs: nonNegativeInteger(stats.totalLatencyMs),
        lastLatencyMs: typeof stats.lastLatencyMs === "number" && Number.isFinite(stats.lastLatencyMs)
            ? Math.max(0, Math.round(stats.lastLatencyMs))
            : null,
        updatedAt: typeof stats.updatedAt === "string" ? stats.updatedAt : null
    };
}
function nonNegativeInteger(value) {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
