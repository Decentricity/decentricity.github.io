import type {
  AnalysisMode,
  ConfidenceThreshold,
  ConCameraDomain,
  ConCameraSettings,
  OverlayDensity,
  ScanMode,
  ViewMode
} from "../types.js";

export const DOMAIN_VALUES = ["general", "urban", "nature", "tech", "vehicle", "food"] as const satisfies readonly ConCameraDomain[];
export const OVERLAY_DENSITY_VALUES = ["minimal", "normal", "full"] as const satisfies readonly OverlayDensity[];
export const ANALYSIS_MODE_VALUES = ["taxonomy", "semantic", "affordance", "risk", "attention"] as const satisfies readonly AnalysisMode[];
export const CONFIDENCE_VALUES = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const satisfies readonly ConfidenceThreshold[];
export const SCAN_MODE_VALUES = ["focus", "balanced", "survey"] as const satisfies readonly ScanMode[];
export const VIEW_MODE_VALUES = ["live", "freeze"] as const satisfies readonly ViewMode[];

export const DEFAULT_MANUAL_SETTINGS: ConCameraSettings = {
  domain: "general",
  overlayDensity: "normal",
  analysisMode: "taxonomy",
  relationsVisible: true,
  boxesVisible: true,
  confidenceThreshold: 0.5,
  scanMode: "balanced",
  viewMode: "live"
};

const STORAGE_KEY = "concamera.overlaySettings.v1";
const LEGACY_STORAGE_KEY = "concamera.manualSettings.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadManualSettings(storage: StorageLike = localStorage): ConCameraSettings {
  const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_MANUAL_SETTINGS };
  }

  try {
    return sanitizeManualSettings(JSON.parse(raw) as Partial<ConCameraSettings>);
  } catch {
    return { ...DEFAULT_MANUAL_SETTINGS };
  }
}

export function saveManualSettings(settings: ConCameraSettings, storage: StorageLike = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeManualSettings(settings)));
}

export function sanitizeManualSettings(candidate: Partial<ConCameraSettings> = {}): ConCameraSettings {
  return {
    domain: isOneOf(candidate.domain, DOMAIN_VALUES) ? candidate.domain : DEFAULT_MANUAL_SETTINGS.domain,
    overlayDensity: isOneOf(candidate.overlayDensity, OVERLAY_DENSITY_VALUES) ? candidate.overlayDensity : DEFAULT_MANUAL_SETTINGS.overlayDensity,
    analysisMode: isOneOf(candidate.analysisMode, ANALYSIS_MODE_VALUES) ? candidate.analysisMode : DEFAULT_MANUAL_SETTINGS.analysisMode,
    relationsVisible: typeof candidate.relationsVisible === "boolean" ? candidate.relationsVisible : DEFAULT_MANUAL_SETTINGS.relationsVisible,
    boxesVisible: typeof candidate.boxesVisible === "boolean" ? candidate.boxesVisible : DEFAULT_MANUAL_SETTINGS.boxesVisible,
    confidenceThreshold: isOneOf(candidate.confidenceThreshold, CONFIDENCE_VALUES) ? candidate.confidenceThreshold : DEFAULT_MANUAL_SETTINGS.confidenceThreshold,
    scanMode: isOneOf(candidate.scanMode, SCAN_MODE_VALUES) ? candidate.scanMode : DEFAULT_MANUAL_SETTINGS.scanMode,
    viewMode: isOneOf(candidate.viewMode, VIEW_MODE_VALUES) ? candidate.viewMode : DEFAULT_MANUAL_SETTINGS.viewMode
  };
}

export function freezeManualSettings(settings: ConCameraSettings): ConCameraSettings {
  return { ...sanitizeManualSettings(settings) };
}

export function nextDomain(current: ConCameraDomain, delta: -1 | 1): ConCameraDomain {
  return nextCircularDetent(current, DOMAIN_VALUES, delta);
}

export function nextOverlayDensity(current: OverlayDensity, delta: -1 | 1): OverlayDensity {
  return nextDetent(current, OVERLAY_DENSITY_VALUES, delta);
}

export function nextAnalysisMode(current: AnalysisMode, delta: -1 | 1): AnalysisMode {
  return nextCircularDetent(current, ANALYSIS_MODE_VALUES, delta);
}

export function nextConfidenceThreshold(current: ConfidenceThreshold, delta: -1 | 1): ConfidenceThreshold {
  return nextDetent(current, CONFIDENCE_VALUES, delta);
}

export function nextScanMode(current: ScanMode, delta: -1 | 1): ScanMode {
  return nextDetent(current, SCAN_MODE_VALUES, delta);
}

export function nextViewMode(current: ViewMode, delta: -1 | 1): ViewMode {
  return nextDetent(current, VIEW_MODE_VALUES, delta);
}

export function snapConfidenceThreshold(value: number): ConfidenceThreshold {
  return nearestDetent(value, CONFIDENCE_VALUES);
}

export function domainLabel(value: ConCameraDomain): string {
  return value.toUpperCase();
}

export function overlayDensityLabel(value: OverlayDensity): string {
  switch (value) {
    case "minimal":
      return "MIN";
    case "full":
      return "FULL";
    case "normal":
    default:
      return "NORM";
  }
}

export function analysisModeLabel(value: AnalysisMode): string {
  return value.toUpperCase();
}

export function confidenceLabel(value: ConfidenceThreshold): string {
  return `${Math.round(value * 100)}`;
}

export function scanModeLabel(value: ScanMode): string {
  return value.toUpperCase();
}

export function viewModeLabel(value: ViewMode): string {
  return value.toUpperCase();
}

export function scanModeObjectLimit(value: ScanMode): number {
  switch (value) {
    case "focus":
      return 4;
    case "survey":
      return 16;
    case "balanced":
    default:
      return 8;
  }
}

export function densityObjectLimit(value: OverlayDensity): number {
  switch (value) {
    case "minimal":
      return 5;
    case "full":
      return 16;
    case "normal":
    default:
      return 8;
  }
}

export function settingsReadout(settings: ConCameraSettings): string {
  const normalized = sanitizeManualSettings(settings);
  return [
    `LENS-${domainLabel(normalized.domain)}`,
    `OVR-${overlayDensityLabel(normalized.overlayDensity)}`,
    `MODE-${analysisModeLabel(normalized.analysisMode)}`,
    `REL-${normalized.relationsVisible ? "ON" : "OFF"}`,
    `BOX-${normalized.boxesVisible ? "ON" : "OFF"}`,
    `C${confidenceLabel(normalized.confidenceThreshold)}`,
    `SCAN-${scanModeLabel(normalized.scanMode)}`,
    `VIEW-${viewModeLabel(normalized.viewMode)}`
  ].join(" ");
}

function nearestDetent<T extends number>(value: number, detents: readonly T[]): T {
  let closest = detents[0] as T;
  let distance = Math.abs(value - closest);
  for (const detent of detents) {
    const nextDistance = Math.abs(value - detent);
    if (nextDistance < distance) {
      closest = detent;
      distance = nextDistance;
    }
  }

  return closest;
}

function nextDetent<T extends string | number>(current: T, detents: readonly T[], delta: -1 | 1): T {
  const index = detents.indexOf(current);
  const nextIndex = Math.max(0, Math.min(detents.length - 1, index + delta));
  return detents[nextIndex] ?? current;
}

function nextCircularDetent<T extends string | number>(current: T, detents: readonly T[], delta: -1 | 1): T {
  const index = Math.max(0, detents.indexOf(current));
  const nextIndex = (index + delta + detents.length) % detents.length;
  return detents[nextIndex] ?? current;
}

function isOneOf<T extends string | number>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}
