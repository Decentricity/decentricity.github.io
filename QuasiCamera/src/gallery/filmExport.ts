import type { AntiCameraFrame } from "../types.js";

const CANVAS_WIDTH = 1400;
const IMAGE_MARGIN = 90;
const IMAGE_SIZE = CANVAS_WIDTH - IMAGE_MARGIN * 2;
const BOTTOM_BORDER = 250;
const CANVAS_HEIGHT = IMAGE_MARGIN + IMAGE_SIZE + BOTTOM_BORDER;

export interface FilmExportDependencies {
  loadImage: (src: string) => Promise<CanvasImageSource>;
  createCanvas: (width: number, height: number) => HTMLCanvasElement;
  canvasToBlob: (canvas: HTMLCanvasElement) => Promise<Blob>;
}

export async function composeFilmFramePng(
  frame: AntiCameraFrame,
  dependencies: FilmExportDependencies = browserFilmExportDependencies()
): Promise<Blob> {
  const canvas = dependencies.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is unavailable");
  }

  const image = await dependencies.loadImage(frame.imageDataUrl);
  context.fillStyle = "#e5dfcf";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = "#11110f";
  context.fillRect(IMAGE_MARGIN, IMAGE_MARGIN, IMAGE_SIZE, IMAGE_SIZE);
  drawImageCover(context, image, IMAGE_MARGIN, IMAGE_MARGIN, IMAGE_SIZE, IMAGE_SIZE);

  context.fillStyle = "#15130f";
  context.font = "42px monospace";
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.fillText(formatSavedTimestamp(frame.timestamp), IMAGE_MARGIN, IMAGE_MARGIN + IMAGE_SIZE + 110);

  return dependencies.canvasToBlob(canvas);
}

export function buildFilmDownloadFilename(frame: AntiCameraFrame): string {
  const safeTimestamp = frame.timestamp.replace(/[:.]/g, "-");
  return `quasi-camera-frame-${safeTimestamp}.png`;
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const sourceWidth = intrinsicWidth(image);
  const sourceHeight = intrinsicHeight(image);
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    context.drawImage(image, x, y, width, height);
    return;
  }

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  const sourceX = x + (width - scaledWidth) / 2;
  const sourceY = y + (height - scaledHeight) / 2;
  context.drawImage(image, sourceX, sourceY, scaledWidth, scaledHeight);
}

function intrinsicWidth(image: CanvasImageSource): number {
  if ("naturalWidth" in image && typeof image.naturalWidth === "number") {
    return image.naturalWidth;
  }

  if ("width" in image && typeof image.width === "number") {
    return image.width;
  }

  return 0;
}

function intrinsicHeight(image: CanvasImageSource): number {
  if ("naturalHeight" in image && typeof image.naturalHeight === "number") {
    return image.naturalHeight;
  }

  if ("height" in image && typeof image.height === "number") {
    return image.height;
  }

  return 0;
}

function browserFilmExportDependencies(): FilmExportDependencies {
  return {
    loadImage,
    createCanvas(width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    canvasToBlob(canvas) {
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Film frame export failed"));
            return;
          }

          resolve(blob);
        }, "image/png");
      });
    }
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Film frame image failed to load"));
    image.src = src;
  });
}

function formatSavedTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}
