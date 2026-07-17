import type { DetectedFace, ProviderImageReference, SourcePhotoReference } from "../types.js";

export interface FaceCrop {
  faceId: string;
  image: ProviderImageReference;
  cropBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export async function createFaceCrops(source: SourcePhotoReference, faces: DetectedFace[]): Promise<FaceCrop[]> {
  if (faces.length === 0) {
    return [];
  }

  const image = await loadImage(source.dataUrl);
  return faces.map((face, index) => createFaceCrop(source, image, face, index));
}

export function expandedFaceBox(
  face: DetectedFace,
  imageWidth: number,
  imageHeight: number,
  widthScale = 1.8,
  heightScale = 2.2
): { x: number; y: number; width: number; height: number } {
  const centerX = face.boundingBox.x + face.boundingBox.width / 2;
  const centerY = face.boundingBox.y + face.boundingBox.height / 2;
  const targetWidth = Math.max(face.boundingBox.width * widthScale, 96);
  const targetHeight = Math.max(face.boundingBox.height * heightScale, 128);
  const targetAspect = targetWidth / targetHeight;
  let width = targetWidth;
  let height = targetHeight;

  if (width / height > targetAspect) {
    height = width / targetAspect;
  } else {
    width = height * targetAspect;
  }

  width = Math.min(width, imageWidth);
  height = Math.min(height, imageHeight);

  const x = clamp(centerX - width / 2, 0, imageWidth - width);
  const y = clamp(centerY - height * 0.45, 0, imageHeight - height);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function createFaceCrop(source: SourcePhotoReference, image: HTMLImageElement, face: DetectedFace, index: number): FaceCrop {
  const cropBox = expandedFaceBox(face, source.width, source.height);
  const canvas = document.createElement("canvas");
  canvas.width = cropBox.width;
  canvas.height = cropBox.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Face crop canvas is unavailable");
  }

  context.drawImage(
    image,
    cropBox.x,
    cropBox.y,
    cropBox.width,
    cropBox.height,
    0,
    0,
    cropBox.width,
    cropBox.height
  );

  return {
    faceId: face.id,
    cropBox,
    image: {
      role: "face-reference",
      name: `selected-face-${index + 1}.jpg`,
      dataUrl: canvas.toDataURL("image/jpeg", 0.94)
    }
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Source image could not be loaded for face crops"));
    image.src = dataUrl;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
