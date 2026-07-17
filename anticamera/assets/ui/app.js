import { ContextCollector } from "../context/contextCollector.js";
import { ImageGenerator } from "../image/imageGenerator.js";
import { PromptBuilder } from "../promptBuilder.js";
import { renderBattery, renderReadout } from "./readout.js";
import { ShutterSound } from "./shutterSound.js";
const PERMISSION_TIMEOUT_MS = 8_000;
const CONTEXT_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 120_000;
const IMAGE_LOAD_TIMEOUT_MS = 15_000;
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
    viewfinder;
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
    shutterSound;
    captureDelay;
    minimumDevelopingTime;
    imageLoadTimeoutMs;
    permissionTimeoutMs;
    contextTimeoutMs;
    generationTimeoutMs;
    debugCapture = new CaptureDebugger();
    developing = false;
    lastContext = null;
    constructor(viewfinder, debugPanel, readout, developingLayer, instantReveal, latestFrame, keyPanel, keyInput, keyMessage, batteryFill, batteryLabel, shutter, modeInputs, manualControls, gallery, dependencies = {}) {
        this.viewfinder = viewfinder;
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
        this.shutterSound = dependencies.shutterSound ?? new ShutterSound();
        this.captureDelay = dependencies.delay ?? delay;
        this.minimumDevelopingTime = dependencies.minimumDevelopingTime ?? (() => 2600 + Math.round(Math.random() * 1800));
        this.imageLoadTimeoutMs = dependencies.imageLoadTimeoutMs ?? IMAGE_LOAD_TIMEOUT_MS;
        this.permissionTimeoutMs = dependencies.permissionTimeoutMs ?? PERMISSION_TIMEOUT_MS;
        this.contextTimeoutMs = dependencies.contextTimeoutMs ?? CONTEXT_TIMEOUT_MS;
        this.generationTimeoutMs = dependencies.generationTimeoutMs ?? GENERATION_TIMEOUT_MS;
    }
    async start() {
        await this.gallery.load().catch((error) => this.debugCapture.log("capture:gallery-load-error", { error: safeError(error) }));
        await this.context.startPassiveCollection().catch((error) => this.debugCapture.log("capture:passive-context-error", { error: safeError(error) }));
        this.shutter.addEventListener("click", () => {
            void this.capture();
        });
        this.viewfinder.addEventListener("click", () => {
            this.setDebugPanelOpen(!this.isDebugPanelOpen());
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
    async capture() {
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
            const context = await withTimeout(this.context.snapshot(this.mode(), frozenPose, frozenSettings, { waitForReverseGeocodeMs: 900 }), this.contextTimeoutMs, "context snapshot");
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
            const frame = {
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
            }
            catch (storageError) {
                this.reportNonFatalStorageFailure(storageError);
            }
            await this.refreshReadout();
            this.debugCapture.log("capture:complete");
        }
        catch (error) {
            this.debugCapture.log("capture:error", { error: safeError(error) });
            await this.captureDelay(minimumDevelopingTime).catch(() => undefined);
            if (isAuthenticationError(error)) {
                this.showKeyPanel(error instanceof Error ? error.message : String(error));
            }
            else {
                this.showCaptureError(error);
            }
        }
        finally {
            this.shutter.disabled = false;
            this.developing = false;
        }
    }
    mode() {
        const selected = [...this.modeInputs].find((input) => input.checked);
        return selected?.value === "indoor" ? "indoor" : "outdoor";
    }
    showDeveloping() {
        this.viewfinder.classList.add("is-developing");
        this.viewfinder.classList.remove("needs-key");
        this.keyPanel.classList.add("hidden");
        this.instantReveal.classList.add("hidden");
        this.latestFrame.classList.add("hidden");
        this.latestFrame.classList.remove("is-developing");
        this.developingLayer.textContent = "DEVELOPING";
        this.developingLayer.classList.remove("hidden");
    }
    showKeyPanel(message = "USER KEY REQUIRED") {
        this.viewfinder.classList.remove("is-developing");
        this.viewfinder.classList.add("needs-key");
        this.developingLayer.classList.add("hidden");
        this.instantReveal.classList.add("hidden");
        this.latestFrame.classList.add("hidden");
        this.keyPanel.classList.remove("hidden");
        this.keyMessage.textContent = message.toUpperCase();
        this.setDebugPanelOpen(true);
        this.keyInput.focus();
    }
    showCaptureError(error) {
        this.viewfinder.classList.remove("is-developing");
        this.viewfinder.classList.remove("needs-key");
        this.keyPanel.classList.add("hidden");
        this.instantReveal.classList.add("hidden");
        this.latestFrame.classList.add("hidden");
        this.developingLayer.textContent = captureErrorMessage(error);
        this.developingLayer.classList.remove("hidden");
    }
    reportNonFatalStorageFailure(error) {
        this.debugCapture.log("capture:gallery-save-error", { error: safeError(error) });
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
        this.instantReveal.classList.remove("hidden");
        this.latestFrame.classList.remove("hidden");
        this.latestFrame.classList.add("is-developing");
        this.developingLayer.classList.add("hidden");
        await this.captureDelay(80);
        this.latestFrame.classList.remove("is-developing");
        await this.captureDelay(3600);
        this.latestFrame.classList.add("hidden");
        this.instantReveal.classList.add("hidden");
        this.viewfinder.classList.remove("is-developing");
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
function captureErrorMessage(error) {
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
function safeError(error) {
    return error instanceof Error ? error.message : String(error);
}
class CaptureDebugger {
    enabled = debugCaptureEnabled();
    startedAt = Date.now();
    log(stage, detail = {}) {
        if (!this.enabled) {
            return;
        }
        console.debug("[anti-camera]", stage, {
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
