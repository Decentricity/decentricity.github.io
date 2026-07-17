import type { DetectedFace, FaceAnalysis, SourcePhotoReference } from "../types.js";

const FACE_ANALYSIS_TIMEOUT_MS = 8_000;

export interface FaceAnalyzer {
  analyze(source: SourcePhotoReference): Promise<FaceAnalysis>;
}

interface NativeFaceDetector {
  detect(input: ImageBitmapSource): Promise<Array<{
    boundingBox: DOMRectReadOnly;
    landmarks?: unknown[];
  }>>;
}

interface NativeFaceDetectorConstructor {
  new(options?: { fastMode?: boolean; maxDetectedFaces?: number }): NativeFaceDetector;
}

declare global {
  interface Window {
    FaceDetector?: NativeFaceDetectorConstructor | undefined;
  }
}

export class BrowserFaceAnalyzer implements FaceAnalyzer {
  constructor(private readonly timeoutMs = FACE_ANALYSIS_TIMEOUT_MS) {}

  async analyze(source: SourcePhotoReference): Promise<FaceAnalysis> {
    if (!window.FaceDetector) {
      return {
        faces: [],
        count: 0,
        provider: "browser-facedetector-unavailable",
        warning: "Browser FaceDetector API unavailable; continuing without preserved real faces."
      };
    }

    const bitmap = await createImageBitmap(source.blob);
    try {
      const detector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 20 });
      const rawFaces = await withTimeout(detector.detect(bitmap), this.timeoutMs, "Face analysis timed out");
      const faces = rawFaces
        .map((raw, index) => normalizeFace(raw.boundingBox, source.width, source.height, index))
        .filter((face) => face.boundingBox.width > 0 && face.boundingBox.height > 0);

      return {
        faces,
        count: faces.length,
        provider: "browser-facedetector"
      };
    } catch (error) {
      return {
        faces: [],
        count: 0,
        provider: "browser-facedetector-error",
        warning: error instanceof Error ? error.message : String(error)
      };
    } finally {
      bitmap.close();
    }
  }
}

function normalizeFace(rect: DOMRectReadOnly, imageWidth: number, imageHeight: number, index: number): DetectedFace {
  const x = clamp(rect.x, 0, imageWidth);
  const y = clamp(rect.y, 0, imageHeight);
  const width = clamp(rect.width, 0, imageWidth - x);
  const height = clamp(rect.height, 0, imageHeight - y);
  const faceCenterX = x + width / 2;
  const faceCenterY = y + height / 2;
  const dx = (faceCenterX - imageWidth / 2) / (imageWidth / 2);
  const dy = (faceCenterY - imageHeight / 2) / (imageHeight / 2);

  return {
    id: `face-${index + 1}`,
    boundingBox: { x, y, width, height },
    confidence: null,
    areaRatio: (width * height) / Math.max(1, imageWidth * imageHeight),
    centerDistance: clamp(Math.hypot(dx, dy) / Math.SQRT2, 0, 1)
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(label)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
