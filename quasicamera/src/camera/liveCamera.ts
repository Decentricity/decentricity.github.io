import type { SourcePhotoReference } from "../types.js";

export interface LiveCameraStatus {
  state: "idle" | "starting" | "ready" | "error";
  message: string;
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  },
  audio: false
};

export class LiveCamera {
  private stream: MediaStream | null = null;
  private status: LiveCameraStatus = {
    state: "idle",
    message: "CAMERA READY"
  };

  constructor(private readonly video: HTMLVideoElement) {
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;

    window.addEventListener("pagehide", () => this.stop());
    window.addEventListener("beforeunload", () => this.stop());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.stop();
      }
    });
  }

  currentStatus(): LiveCameraStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.stream && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.status = {
        state: "error",
        message: "CAMERA UNAVAILABLE"
      };
      throw new Error("Device camera is unavailable in this browser");
    }

    this.status = {
      state: "starting",
      message: "CAMERA STARTING"
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      this.video.srcObject = this.stream;
      await this.video.play();
      await waitForVideoFrame(this.video);
      this.status = {
        state: "ready",
        message: "CAMERA READY"
      };
    } catch (error) {
      this.stop();
      this.status = {
        state: "error",
        message: isPermissionDenied(error) ? "CAMERA DENIED" : "CAMERA ERROR"
      };
      throw new Error(this.status.message);
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.status = {
      state: "idle",
      message: "CAMERA READY"
    };
  }

  async captureStill(): Promise<SourcePhotoReference> {
    await this.start();

    const track = this.stream?.getVideoTracks()[0];
    if (track && "ImageCapture" in window) {
      try {
        const imageCapture = new (window as Window & { ImageCapture: ImageCaptureConstructor }).ImageCapture(track);
        const blob = await imageCapture.takePhoto();
        return await sourceFromBlob(blob, new Date().toISOString());
      } catch {
        // Fall back to the video canvas path; Android implementations vary.
      }
    }

    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    if (!width || !height) {
      throw new Error("No camera frame is available");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Camera capture canvas is unavailable");
    }

    context.drawImage(this.video, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    return {
      blob,
      dataUrl,
      width,
      height,
      capturedAt: new Date().toISOString(),
      estimatedBytes: Math.max(blob.size, Math.ceil((width * height * 4) / 4))
    };
  }
}

interface ImageCaptureConstructor {
  new(track: MediaStreamTrack): {
    takePhoto(): Promise<Blob>;
  };
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Camera preview timed out"));
    }, 8_000);
    const cleanup = (): void => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
    };
    const onLoaded = (): void => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("canplay", onLoaded);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Still image encoding failed"));
      }
    }, type, quality);
  });
}

async function sourceFromBlob(blob: Blob, capturedAt: string): Promise<SourcePhotoReference> {
  const dataUrl = await blobToDataUrl(blob);
  const dimensions = await imageDimensions(dataUrl);
  return {
    blob,
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
    capturedAt,
    estimatedBytes: Math.max(blob.size, Math.ceil((dimensions.width * dimensions.height * 4) / 4))
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Image read failed"));
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Captured image dimensions are unavailable"));
    image.src = dataUrl;
  });
}

function isPermissionDenied(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "NotAllowedError" || error.name === "PermissionDeniedError"
    : error instanceof Error && /denied|notallowed/i.test(error.message);
}
