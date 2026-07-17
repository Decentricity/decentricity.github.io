import { Gallery } from "./gallery/gallery.js";
import { FrameStorage } from "./gallery/storage.js";
import { AntiCameraApp } from "./ui/app.js";
import { ManualControls } from "./ui/manualControls.js";
import { FullscreenController } from "./ui/fullscreenController.js";
import { registerPwa } from "./pwa.js";
function requiredElement(id, constructor) {
    const element = document.getElementById(id);
    if (!(element instanceof constructor)) {
        throw new Error(`Missing element #${id}`);
    }
    return element;
}
const storage = new FrameStorage();
const gallery = new Gallery(requiredElement("film-strip", HTMLOListElement), requiredElement("export-json", HTMLButtonElement), storage);
const manualControls = new ManualControls(requiredElement("manual-controls", HTMLElement));
new FullscreenController(requiredElement("fullscreen-button", HTMLButtonElement));
registerPwa();
const app = new AntiCameraApp(requiredElement("app-shell", HTMLElement), requiredElement("camera-view", HTMLElement), requiredElement("film-view", HTMLElement), requiredElement("view-toggle", HTMLButtonElement), requiredElement("viewfinder", HTMLElement), requiredElement("debug-panel", HTMLElement), requiredElement("context-readout", HTMLElement), requiredElement("developing", HTMLElement), requiredElement("instant-reveal", HTMLElement), requiredElement("latest-frame", HTMLImageElement), requiredElement("key-panel", HTMLFormElement), requiredElement("openai-key", HTMLInputElement), requiredElement("key-message", HTMLElement), requiredElement("battery-fill", HTMLElement), requiredElement("battery-label", HTMLElement), requiredElement("shutter", HTMLButtonElement), document.querySelectorAll("input[name='scene-mode']"), manualControls, gallery);
void app.start();
