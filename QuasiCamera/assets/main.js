import { Gallery } from "./gallery/gallery.js";
import { FrameStorage } from "./gallery/storage.js";
import { LiveCamera } from "./camera/liveCamera.js";
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
const gallery = new Gallery(requiredElement("film-strip", HTMLOListElement), requiredElement("export-json", HTMLButtonElement), storage, requiredElement("film-zoom", HTMLElement), requiredElement("film-zoom-image", HTMLImageElement), requiredElement("film-zoom-time", HTMLTimeElement), requiredElement("film-zoom-close", HTMLButtonElement), requiredElement("film-zoom-save", HTMLButtonElement));
const manualControls = new ManualControls(requiredElement("manual-controls", HTMLElement));
const liveCamera = new LiveCamera(requiredElement("camera-preview", HTMLVideoElement));
new FullscreenController(requiredElement("fullscreen-button", HTMLButtonElement));
registerPwa();
const app = new AntiCameraApp(requiredElement("app-shell", HTMLElement), requiredElement("camera-view", HTMLElement), requiredElement("film-view", HTMLElement), requiredElement("view-toggle", HTMLButtonElement), requiredElement("viewfinder", HTMLElement), requiredElement("debug-panel", HTMLElement), requiredElement("context-readout", HTMLElement), requiredElement("developing", HTMLElement), requiredElement("instant-reveal", HTMLElement), requiredElement("latest-frame", HTMLImageElement), requiredElement("key-panel", HTMLFormElement), requiredElement("openai-key", HTMLInputElement), requiredElement("key-message", HTMLElement), requiredElement("battery-fill", HTMLElement), requiredElement("battery-label", HTMLElement), requiredElement("shutter", HTMLButtonElement), document.querySelectorAll("input[name='scene-mode']"), manualControls, gallery, {
    liveCamera
});
void app.start();
