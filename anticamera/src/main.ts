import { Gallery } from "./gallery/gallery.js";
import { FrameStorage } from "./gallery/storage.js";
import { AntiCameraApp } from "./ui/app.js";

function requiredElement<T extends HTMLElement>(id: string, constructor: { new (): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing element #${id}`);
  }

  return element;
}

const storage = new FrameStorage();
const gallery = new Gallery(
  requiredElement("film-strip", HTMLOListElement),
  requiredElement("export-json", HTMLButtonElement),
  storage
);

const app = new AntiCameraApp(
  requiredElement("viewfinder", HTMLElement),
  requiredElement("context-readout", HTMLElement),
  requiredElement("developing", HTMLElement),
  requiredElement("latest-frame", HTMLImageElement),
  requiredElement("key-panel", HTMLFormElement),
  requiredElement("openai-key", HTMLInputElement),
  requiredElement("key-message", HTMLElement),
  requiredElement("battery-fill", HTMLElement),
  requiredElement("battery-label", HTMLElement),
  requiredElement("shutter", HTMLButtonElement),
  document.querySelectorAll<HTMLInputElement>("input[name='scene-mode']"),
  gallery
);

void app.start();
