import type { AntiCameraContext } from "./types.js";

function value(label: string, detail: string | number | undefined | null): string {
  if (detail === undefined || detail === null || detail === "") {
    return `${label}: unknown`;
  }

  return `${label}: ${detail}`;
}

export class PromptBuilder {
  build(context: AntiCameraContext): string {
    const location = context.location;
    const weather = context.weather;
    const audio = context.audio;
    const orientation = context.orientation;
    const motion = context.motion;
    const device = context.device;

    const lines = [
      "You are Anti-Camera, a lensless camera that records context rather than light.",
      "Imagine what could plausibly exist at this place and time from contextual clues only.",
      "Do not claim to recreate reality. Do not include fantasy, surrealism, illustration, painting, CGI, or visible AI artifacts.",
      "Make the result look like a realistic compact point-and-shoot photograph on instant film.",
      "Use ordinary photographic imperfections: available light, weather haze, flash falloff, slight handheld framing, natural grain.",
      "",
      "Context captured at shutter press:",
      value("Local date", context.time.date),
      value("Local time", context.time.time),
      value("Timezone", context.time.timezone),
      value("Day period", context.time.dayPeriod),
      value("Indoor/outdoor switch", context.mode),
      value("Location label", location.label),
      value("Latitude", location.latitude),
      value("Longitude", location.longitude),
      value("GPS accuracy meters", location.accuracy),
      value("Weather", weather.description),
      value("Temperature C", weather.temperatureC),
      value("Humidity percent", weather.humidityPercent),
      value("Cloud cover percent", weather.cloudCoverPercent),
      value("Rain mm", weather.rainMm),
      value("Wind kph", weather.windKph),
      value("Heading degrees", orientation.headingDegrees),
      value("Tilt", orientation.tilt),
      value("Movement", motion.movement),
      value("Acceleration magnitude", motion.accelerationMagnitude),
      value("Ambient audio", audio.descriptor),
      value("Average volume", audio.averageVolume),
      value("Noisiness", audio.noisiness),
      value("Speech probability", audio.speechProbability),
      value("Device type", device.deviceType),
      value("Viewport", `${device.viewport.width}x${device.viewport.height} ${device.viewport.orientation}`),
      value("Language", device.language),
      "",
      "Compose one plausible photograph from these facts. No captions, no interface, no text overlay."
    ];

    return lines.join("\n");
  }
}

