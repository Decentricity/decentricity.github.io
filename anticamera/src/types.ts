export type PermissionStateName = "pending" | "granted" | "denied" | "unavailable" | "error";
export type IndoorOutdoor = "indoor" | "outdoor";
export type FocusStyle = "deep-focus" | "bokeh";
export type SubjectMode = "landscape" | "single-person" | "group" | "crowd";
export type FlashMode = "off" | "on";
export type ExposureCompensationEv = -3 | -2 | -1 | 0 | 1 | 2 | 3;
export type FilmIso = 80 | 100 | 125 | 160 | 200 | 250 | 320 | 400 | 500 | 640 | 800 | 1000;

export interface ManualCameraSettings {
  focusStyle: FocusStyle;
  exposureCompensationEv: ExposureCompensationEv;
  subjectMode: SubjectMode;
  flashMode: FlashMode;
  iso: FilmIso;
}

export interface TimeContext {
  iso: string;
  date: string;
  time: string;
  timezone: string;
  hour: number;
  dayPeriod: "night" | "morning" | "afternoon" | "evening";
}

export interface GeoContext {
  status: PermissionStateName;
  latitude?: number | undefined;
  longitude?: number | undefined;
  altitude?: number | null | undefined;
  accuracy?: number | undefined;
  heading?: number | null | undefined;
  speed?: number | null | undefined;
  city?: string | undefined;
  region?: string | undefined;
  country?: string | undefined;
  label: string;
  updatedAt?: string | undefined;
  error?: string | undefined;
}

export interface WeatherContext {
  status: PermissionStateName;
  temperatureC?: number | undefined;
  humidityPercent?: number | undefined;
  cloudCoverPercent?: number | undefined;
  rainMm?: number | undefined;
  windKph?: number | undefined;
  description: string;
  updatedAt?: string | undefined;
  error?: string | undefined;
}

export interface CameraPose {
  azimuthDeg: number | null;
  pitchDeg: number | null;
  rollDeg: number | null;
  screenOrientationDeg: number;
  confidence: "high" | "medium" | "low";
  capturedAt: number;
}

export interface OrientationContext {
  status: PermissionStateName;
  alpha?: number | null | undefined;
  beta?: number | null | undefined;
  gamma?: number | null | undefined;
  webkitCompassHeading?: number | null | undefined;
  sampleAgeMs?: number | undefined;
  aim: string;
}

export interface MotionContext {
  status: PermissionStateName;
  accelerationMagnitude?: number | undefined;
  rotationRate?: number | undefined;
  movement: "Unknown" | "Still" | "Handheld" | "Walking" | "Riding";
}

export interface AmbientAudioFeatures {
  status: PermissionStateName;
  averageVolume?: number | undefined;
  loudnessDb?: number | undefined;
  noisiness?: number | undefined;
  spectralCentroidHz?: number | undefined;
  bassEnergy?: number | undefined;
  midEnergy?: number | undefined;
  trebleEnergy?: number | undefined;
  speechProbability?: number | undefined;
  descriptor: "Unknown" | "Silence" | "Quiet" | "Loud" | "Busy street" | "Crowd-like" | "Wind" | "Nature";
  error?: string | undefined;
}

export interface BatteryContext {
  status: PermissionStateName;
  levelPercent?: number | undefined;
  charging?: boolean | undefined;
}

export interface DeviceContext {
  language: string;
  languages: string[];
  deviceType: "phone" | "tablet" | "desktop";
  viewport: {
    width: number;
    height: number;
    pixelRatio: number;
    orientation: "portrait" | "landscape";
  };
  screen: {
    width?: number | undefined;
    height?: number | undefined;
    colorDepth?: number | undefined;
  };
  screenBrightness: "unavailable" | "unknown";
  ambientLightLux?: number | undefined;
  connectionType?: string | undefined;
  userAgent: string;
}

export interface AntiCameraContext {
  capturedAt: string;
  mode: IndoorOutdoor;
  time: TimeContext;
  location: GeoContext;
  weather: WeatherContext;
  cameraPose: CameraPose;
  manualSettings: ManualCameraSettings;
  orientation: OrientationContext;
  motion: MotionContext;
  audio: AmbientAudioFeatures;
  battery: BatteryContext;
  device: DeviceContext;
}

export interface ImageGenerationRequest {
  context: AntiCameraContext;
  prompt: string;
}

export interface ImageGenerationResult {
  imageDataUrl: string;
  provider: string;
  fallbackReason?: string | undefined;
}

export interface AntiCameraFrame {
  id: string;
  timestamp: string;
  imageDataUrl: string;
  provider: string;
  prompt: string;
  context: AntiCameraContext;
  generationError?: string | undefined;
}
