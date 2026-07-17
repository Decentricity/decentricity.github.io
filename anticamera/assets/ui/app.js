import { ContextCollector } from "../context/contextCollector.js";
import { ImageGenerator } from "../image/imageGenerator.js";
import { PromptBuilder } from "../promptBuilder.js";
import { renderBattery, renderReadout } from "./readout.js";
import { ShutterSound } from "./shutterSound.js";
function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
export class AntiCameraApp {
    viewfinder;
    readout;
    developingLayer;
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
    context = new ContextCollector();
    promptBuilder = new PromptBuilder();
    imageGenerator = new ImageGenerator();
    shutterSound = new ShutterSound();
    developing = false;
    lastContext = null;
    constructor(viewfinder, readout, developingLayer, latestFrame, keyPanel, keyInput, keyMessage, batteryFill, batteryLabel, shutter, modeInputs, manualControls, gallery) {
        this.viewfinder = viewfinder;
        this.readout = readout;
        this.developingLayer = developingLayer;
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
    }
    async start() {
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
    async refreshReadout() {
        this.lastContext = await this.context.snapshot(this.mode(), undefined, this.manualControls.currentSettings());
        renderReadout(this.readout, this.lastContext);
        renderBattery(this.batteryFill, this.batteryLabel, this.lastContext);
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
        }
        catch (error) {
            await delay(minimumDevelopingTime);
            this.showKeyPanel(error instanceof Error ? error.message : String(error));
            this.shutter.disabled = false;
            this.developing = false;
            return;
        }
        const frame = {
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
    mode() {
        const selected = [...this.modeInputs].find((input) => input.checked);
        return selected?.value === "indoor" ? "indoor" : "outdoor";
    }
    showDeveloping() {
        this.viewfinder.classList.add("is-dark");
        this.viewfinder.classList.remove("needs-key");
        this.keyPanel.classList.add("hidden");
        this.latestFrame.classList.add("hidden");
        this.latestFrame.classList.remove("is-developing");
        this.developingLayer.classList.remove("hidden");
    }
    showKeyPanel(message = "USER KEY REQUIRED") {
        this.viewfinder.classList.remove("is-dark");
        this.viewfinder.classList.add("needs-key");
        this.developingLayer.classList.add("hidden");
        this.latestFrame.classList.add("hidden");
        this.keyPanel.classList.remove("hidden");
        this.keyMessage.textContent = message.toUpperCase();
        this.keyInput.focus();
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
