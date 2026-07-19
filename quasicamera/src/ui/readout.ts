import type { AntiCameraContext } from "../types.js";
import { aimLabelForPitch, frameLabelForScreen } from "../context/cameraPose.js";
import { groundingModeLabel, sanitizeManualSettings, settingsReadout, subjectModeLabel } from "../context/manualSettings.js";
import { formatDegrees, round } from "../context/utils.js";

export function renderReadout(container: HTMLElement, context: AntiCameraContext): void {
  const pose = context.cameraPose;
  const settings = sanitizeManualSettings(context.manualSettings);
  const reverse = context.location.reverseGeocode;
  const address = reverse?.address;
  const feature = reverse?.feature;
  const sourceImageAttached = context.quasiCamera?.sourceImageAttached ?? settings.groundingMode === "grounded";
  const rows: Array<[string, string]> = [
    ["Location", context.location.label],
    ...optionalRows([
      ["Feature", feature?.name],
      ["Feature type", feature?.type],
      ["Street", address?.road],
      ["Neighborhood", address?.neighborhood],
      ["Suburb", address?.suburb],
      ["City", address?.city || address?.municipality],
      ["Distance", feature?.distanceMeters === null || feature?.distanceMeters === undefined ? undefined : `~${feature.distanceMeters}m`],
      ["Location confidence", reverse?.confidence ? capitalize(reverse.confidence) : undefined]
    ]),
    ["Heading", formatDegrees(pose.azimuthDeg)],
    ["Pitch", signedDegrees(pose.pitchDeg)],
    ["Roll", signedDegrees(pose.rollDeg)],
    ["Aim", aimLabelForPitch(pose.pitchDeg)],
    ["Frame", frameLabelForScreen(pose.screenOrientationDeg)],
    ["Pose", `${capitalize(pose.confidence)} confidence`],
    ["Mode", subjectModeLabel(settings.subjectMode)],
    ["Grounding", groundingModeLabel(settings.groundingMode)],
    ["Source image attached", sourceImageAttached ? "YES" : "NO"],
    ["Settings", settingsReadout(settings)],
    ["Time", context.time.time],
    ["Weather", weatherLine(context)],
    ["Noise", audioLine(context)],
    ["Indoor", context.mode === "indoor" ? "Yes" : "No"],
    ["Movement", context.motion.movement],
    ["Battery", batteryLine(context)],
    ["GPS Accuracy", context.location.accuracy === undefined ? "--" : `${context.location.accuracy}m`],
    ["Viewport", `${context.device.viewport.width}x${context.device.viewport.height}`],
    ["Language", context.device.language]
  ];

  container.replaceChildren(...rows.flatMap(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = `${label}:`;
    const detail = document.createElement("dd");
    detail.textContent = value;
    return [term, detail];
  }));
}

export function renderBattery(fill: HTMLElement, label: HTMLElement, context: AntiCameraContext): void {
  const level = context.battery.levelPercent;
  fill.style.width = level === undefined ? "0%" : `${level}%`;
  label.textContent = level === undefined ? "--%" : `${level}%`;
}

function weatherLine(context: AntiCameraContext): string {
  const weather = context.weather;
  const temp = weather.temperatureC === undefined ? "" : ` ${weather.temperatureC}C`;
  const rain = weather.rainMm && weather.rainMm > 0 ? ` ${weather.rainMm}mm` : "";
  return `${weather.description}${temp}${rain}`;
}

function audioLine(context: AntiCameraContext): string {
  const audio = context.audio;
  const volume = audio.averageVolume === undefined ? "" : ` ${round(audio.averageVolume, 2)}`;
  return `${audio.descriptor}${volume}`;
}

function batteryLine(context: AntiCameraContext): string {
  const battery = context.battery;
  if (battery.levelPercent === undefined) {
    return "--";
  }

  return `${battery.levelPercent}%${battery.charging ? " charging" : ""}`;
}

function signedDegrees(value: number | null): string {
  if (value === null) {
    return "--";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} deg`;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function optionalRows(rows: Array<[string, string | undefined | null]>): Array<[string, string]> {
  return rows.flatMap(([label, detail]) => detail ? [[label, detail]] : []);
}
