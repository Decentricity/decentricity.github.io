import type { AntiCameraContext } from "../types.js";
import { formatDegrees, round } from "../context/utils.js";

export function renderReadout(container: HTMLElement, context: AntiCameraContext): void {
  const rows: Array<[string, string]> = [
    ["Location", context.location.label],
    ["Heading", formatDegrees(context.orientation.headingDegrees)],
    ["Tilt", context.orientation.tilt],
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

