import { round, safeError } from "./utils.js";
const WEATHER_TIMEOUT_MS = 8_000;
export class WeatherService {
    cache = null;
    async snapshot(location) {
        if (location.status !== "granted" || location.latitude === undefined || location.longitude === undefined) {
            return {
                status: location.status === "denied" ? "denied" : "pending",
                description: "Waiting for weather"
            };
        }
        const key = `${round(location.latitude, 2)}:${round(location.longitude, 2)}`;
        if (this.cache && this.cache.key === key && this.cache.expiresAt > Date.now()) {
            return this.cache.weather;
        }
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(location.latitude));
        url.searchParams.set("longitude", String(location.longitude));
        url.searchParams.set("current", [
            "temperature_2m",
            "relative_humidity_2m",
            "cloud_cover",
            "rain",
            "showers",
            "snowfall",
            "weather_code",
            "wind_speed_10m"
        ].join(","));
        url.searchParams.set("timezone", "auto");
        try {
            const response = await fetchWithTimeout(url, WEATHER_TIMEOUT_MS);
            if (!response.ok) {
                throw new Error(`weather ${response.status}`);
            }
            const data = (await response.json());
            const current = data.current;
            if (!current) {
                throw new Error("weather unavailable");
            }
            const rain = (current.rain || 0) + (current.showers || 0) + (current.snowfall || 0);
            const weather = {
                status: "granted",
                temperatureC: round(current.temperature_2m, 1),
                humidityPercent: round(current.relative_humidity_2m),
                cloudCoverPercent: round(current.cloud_cover),
                rainMm: round(rain, 1),
                windKph: round(current.wind_speed_10m, 1),
                description: this.describe(current.weather_code, rain, current.cloud_cover),
                updatedAt: current.time
            };
            this.cache = {
                key,
                expiresAt: Date.now() + 10 * 60_000,
                weather
            };
            return weather;
        }
        catch (error) {
            return {
                status: "error",
                description: "Weather unavailable",
                error: safeError(error)
            };
        }
    }
    describe(code, rainMm, cloudCover) {
        if (rainMm >= 6) {
            return "Heavy rain";
        }
        if (rainMm > 0) {
            return "Rain";
        }
        if (code === undefined) {
            return "Unknown";
        }
        if ([95, 96, 99].includes(code)) {
            return "Thunderstorm";
        }
        if ([71, 73, 75, 77, 85, 86].includes(code)) {
            return "Snow";
        }
        if ([45, 48].includes(code)) {
            return "Fog";
        }
        if ((cloudCover ?? 0) >= 85 || [3].includes(code)) {
            return "Overcast";
        }
        if ((cloudCover ?? 0) >= 45 || [2].includes(code)) {
            return "Cloudy";
        }
        if ([1].includes(code)) {
            return "Partly clear";
        }
        return "Clear";
    }
}
async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal });
    }
    finally {
        globalThis.clearTimeout(timeoutId);
    }
}
