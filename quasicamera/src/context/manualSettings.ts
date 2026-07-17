import type {
  ExposureCompensationEv,
  FilmIso,
  FlashMode,
  FocusStyle,
  ManualCameraSettings,
  SubjectMode
} from "../types.js";

export const EXPOSURE_VALUES = [-3, -2, -1, 0, 1, 2, 3] as const satisfies readonly ExposureCompensationEv[];
export const ISO_VALUES = [80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000] as const satisfies readonly FilmIso[];
export const SUBJECT_MODES = ["landscape", "single-person", "group", "crowd"] as const satisfies readonly SubjectMode[];
export const FOCUS_STYLES = ["deep-focus", "bokeh"] as const satisfies readonly FocusStyle[];
export const FLASH_MODES = ["off", "on"] as const satisfies readonly FlashMode[];

export const DEFAULT_MANUAL_SETTINGS: ManualCameraSettings = {
  focusStyle: "deep-focus",
  exposureCompensationEv: 0,
  subjectMode: "landscape",
  flashMode: "off",
  iso: 200
};

const STORAGE_KEY = "quasicamera.manualSettings.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadManualSettings(storage: StorageLike = localStorage): ManualCameraSettings {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_MANUAL_SETTINGS };
  }

  try {
    return sanitizeManualSettings(JSON.parse(raw) as Partial<ManualCameraSettings>);
  } catch {
    return { ...DEFAULT_MANUAL_SETTINGS };
  }
}

export function saveManualSettings(settings: ManualCameraSettings, storage: StorageLike = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeManualSettings(settings)));
}

export function sanitizeManualSettings(candidate: Partial<ManualCameraSettings> = {}): ManualCameraSettings {
  return {
    focusStyle: isOneOf(candidate.focusStyle, FOCUS_STYLES) ? candidate.focusStyle : DEFAULT_MANUAL_SETTINGS.focusStyle,
    exposureCompensationEv: isOneOf(candidate.exposureCompensationEv, EXPOSURE_VALUES)
      ? candidate.exposureCompensationEv
      : DEFAULT_MANUAL_SETTINGS.exposureCompensationEv,
    subjectMode: isOneOf(candidate.subjectMode, SUBJECT_MODES) ? candidate.subjectMode : DEFAULT_MANUAL_SETTINGS.subjectMode,
    flashMode: isOneOf(candidate.flashMode, FLASH_MODES) ? candidate.flashMode : DEFAULT_MANUAL_SETTINGS.flashMode,
    iso: isOneOf(candidate.iso, ISO_VALUES) ? candidate.iso : DEFAULT_MANUAL_SETTINGS.iso
  };
}

export function freezeManualSettings(settings: ManualCameraSettings): ManualCameraSettings {
  return { ...sanitizeManualSettings(settings) };
}

export function snapExposure(value: number): ExposureCompensationEv {
  return nearestDetent(value, EXPOSURE_VALUES);
}

export function snapIso(value: number): FilmIso {
  return nearestDetent(value, ISO_VALUES);
}

export function nextExposure(current: ExposureCompensationEv, delta: -1 | 1): ExposureCompensationEv {
  return nextDetent(current, EXPOSURE_VALUES, delta);
}

export function nextIso(current: FilmIso, delta: -1 | 1): FilmIso {
  return nextDetent(current, ISO_VALUES, delta);
}

export function subjectModeLabel(mode: SubjectMode): string {
  switch (mode) {
    case "single-person":
      return "1 PERSON";
    case "group":
      return "GROUP";
    case "crowd":
      return "CROWD";
    case "landscape":
    default:
      return "LANDSCAPE";
  }
}

export function subjectModeShort(mode: SubjectMode): string {
  switch (mode) {
    case "single-person":
      return "P1";
    case "group":
      return "P3";
    case "crowd":
      return "CRWD";
    case "landscape":
    default:
      return "LAND";
  }
}

export function focusStyleLabel(style: FocusStyle): string {
  return style === "bokeh" ? "BOKEH" : "DEEP";
}

export function focusStyleShort(style: FocusStyle): string {
  return style === "bokeh" ? "BKH" : "DF";
}

export function evLabel(value: ExposureCompensationEv): string {
  return `${value > 0 ? "+" : ""}${value}EV`;
}

export function flashLabel(value: FlashMode): string {
  return value === "on" ? "ON" : "OFF";
}

export function settingsReadout(settings: ManualCameraSettings): string {
  return [
    subjectModeShort(settings.subjectMode),
    focusStyleShort(settings.focusStyle),
    evLabel(settings.exposureCompensationEv),
    `FL-${flashLabel(settings.flashMode)}`,
    `ISO${settings.iso}`
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

function nextDetent<T extends number>(current: T, detents: readonly T[], delta: -1 | 1): T {
  const index = detents.indexOf(current);
  const nextIndex = Math.max(0, Math.min(detents.length - 1, index + delta));
  return detents[nextIndex] ?? current;
}

function isOneOf<T extends string | number>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}
