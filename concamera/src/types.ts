export type PermissionStateName = "pending" | "granted" | "denied" | "unavailable" | "error";
export type IndoorOutdoor = "indoor" | "outdoor";

export type ConCameraDomain = "general" | "urban" | "nature" | "tech" | "vehicle" | "food";
export type OverlayDensity = "minimal" | "normal" | "full";
export type AnalysisMode = "taxonomy" | "semantic" | "affordance" | "risk" | "attention";
export type ScanMode = "focus" | "balanced" | "survey";
export type ViewMode = "live" | "freeze";
export type ConfidenceThreshold = 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9;
export type SubjectMode = "landscape" | "single-person" | "group" | "crowd";

export interface ConCameraSettings {
  domain: ConCameraDomain;
  overlayDensity: OverlayDensity;
  analysisMode: AnalysisMode;
  relationsVisible: boolean;
  boxesVisible: boolean;
  confidenceThreshold: ConfidenceThreshold;
  scanMode: ScanMode;
  viewMode: ViewMode;
}

export type ManualCameraSettings = ConCameraSettings;

export interface TimeContext {
  iso: string;
  date: string;
  time: string;
  timezone: string;
  hour: number;
  dayPeriod: "night" | "morning" | "afternoon" | "evening";
}

export interface ReverseGeocodedLocation {
  provider: string;
  displayName: string | null;
  feature: {
    name: string | null;
    type: string | null;
    category: string | null;
    latitude: number | null;
    longitude: number | null;
    distanceMeters: number | null;
  };
  address: {
    houseNumber: string | null;
    road: string | null;
    neighborhood: string | null;
    suburb: string | null;
    district: string | null;
    city: string | null;
    municipality: string | null;
    county: string | null;
    region: string | null;
    postcode: string | null;
    country: string | null;
    countryCode: string | null;
  };
  confidence: "high" | "medium" | "low";
  resolvedAt: string;
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
  reverseGeocode?: ReverseGeocodedLocation | undefined;
  reverseGeocodeStatus?: PermissionStateName | undefined;
  reverseGeocodeError?: string | undefined;
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
  conCamera?: ConCameraShotAnalysis | undefined;
}

export interface SourcePhotoReference {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
  estimatedBytes: number;
}

export interface ProviderImageReference {
  dataUrl: string;
  role: "source" | "face-reference";
  name: string;
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedFace {
  id: string;
  boundingBox: FaceBoundingBox;
  confidence: number | null;
  areaRatio: number;
  centerDistance: number;
}

export interface FaceAnalysis {
  faces: DetectedFace[];
  count: number;
  provider: string;
  warning?: string | undefined;
}

export type ObjectCategory =
  | "animal"
  | "toy"
  | "vehicle"
  | "furniture"
  | "food"
  | "plant"
  | "clothing"
  | "container"
  | "electronics"
  | "tool"
  | "building"
  | "natural-feature"
  | "other";

export type ObjectRelationshipPredicate =
  | "on-top-of"
  | "under"
  | "inside"
  | "holding"
  | "wearing"
  | "attached-to"
  | "next-to"
  | "in-front-of"
  | "behind"
  | "surrounding"
  | "riding"
  | "sitting-on"
  | "standing-on"
  | "carrying"
  | "part-of";

export interface RecognizedObject {
  id: string;
  label: string;
  normalizedLabel: string;
  category: ObjectCategory;
  boundingBox: FaceBoundingBox | null;
  confidence: number | null;
  salience: number;
  attributes: string[];
  count?: number | undefined;
}

export interface ObjectRelationship {
  subjectObjectId: string;
  predicate: ObjectRelationshipPredicate;
  objectObjectId: string;
  confidence: number | null;
}

export interface ObjectAnalysis {
  objects: RecognizedObject[];
  relationships: ObjectRelationship[];
  provider: string;
  warnings: string[];
  metrics?: ObjectAnalysisMetrics | undefined;
  omittedObjects?: Array<{
    label: string;
    normalizedLabel: string;
    reason: string;
  }> | undefined;
}

export interface ObjectAnalysisMetrics {
  modelLoadMs?: number | undefined;
  detectorInferenceMs: number;
  classifierInferenceMs?: number | undefined;
  relationshipInferenceMs: number;
  overlayRenderMs?: number | undefined;
  captureMs?: number | undefined;
  totalObjectAnalysisMs: number;
  totalMs?: number | undefined;
  backend: string;
  detectedCount: number;
  preservedCount: number;
  detector: string;
  classifier: string | null;
  modelStatus: "ready" | "loading" | "failed";
}

export interface PersistedRecognizedObject {
  label: string;
  normalizedLabel: string;
  category: ObjectCategory;
  attributes?: string[] | undefined;
  count?: number | undefined;
}

export interface PersistedObjectRelationship {
  subject: string;
  predicate: ObjectRelationshipPredicate;
  object: string;
}

export type SubjectMappingStrategy =
  | "synthetic-subjects"
  | "environmental-likeness"
  | "preserved-hero"
  | "preserved-plus-synthetic-group"
  | "preserved-group"
  | "preserved-plus-synthetic-crowd";

export interface SubjectFaceSelection {
  subjectMode: SubjectMode;
  strategy: SubjectMappingStrategy;
  selectedFaces: DetectedFace[];
  selectedFaceIds: string[];
  selectedFaceCount: number;
  detectedFaceCount: number;
  syntheticSubjectInstruction: string;
  promptInstruction: string;
  maxFacesApplied: number;
}

export interface ConCameraShotAnalysis {
  detectedFaceCount: number;
  faceAnalysisProvider: string;
  faceAnalysisWarning?: string | undefined;
  overlaySettings?: ConCameraSettings | undefined;
  recognizedObjects?: PersistedRecognizedObject[] | undefined;
  objectRelationships?: PersistedObjectRelationship[] | undefined;
  objectAnalysisProvider?: string | undefined;
  objectAnalysisWarnings?: string[] | undefined;
  objectAnalysisMetrics?: ObjectAnalysisMetrics | undefined;
  sceneSummary?: string | undefined;
  renderVersion?: string | undefined;
  sourceImageTransmitted?: boolean | undefined;
  omittedObjects?: Array<{
    label: string;
    normalizedLabel: string;
    reason: string;
  }> | undefined;
}

export interface AntiCameraFrame {
  id: string;
  timestamp: string;
  imageDataUrl: string;
  provider: string;
  prompt?: string | undefined;
  sceneSummary?: string | undefined;
  context: AntiCameraContext;
  generationError?: string | undefined;
  analysisError?: string | undefined;
}
