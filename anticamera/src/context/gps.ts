import type { GeoContext } from "../types.js";
import { compactLabel, round, safeError } from "./utils.js";

interface ReverseGeocodeResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

export class GpsSensor {
  private current: GeoContext = {
    status: "pending",
    label: "Waiting for GPS"
  };

  private watchId: number | null = null;
  private reverseKey = "";

  start(): void {
    if (!("geolocation" in navigator)) {
      this.current = {
        status: "unavailable",
        label: "No browser GPS"
      };
      return;
    }

    if (this.watchId !== null) {
      return;
    }

    // Hardware migration: browser GPS becomes a dedicated GNSS module on the physical device.
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = position.coords;
        this.current = {
          status: "granted",
          latitude: round(coords.latitude, 6),
          longitude: round(coords.longitude, 6),
          altitude: coords.altitude,
          accuracy: round(coords.accuracy, 1),
          heading: coords.heading,
          speed: coords.speed,
          label: this.current.city
            ? compactLabel([this.current.city, this.current.country])
            : `${round(coords.latitude, 4)}, ${round(coords.longitude, 4)}`,
          city: this.current.city,
          region: this.current.region,
          country: this.current.country,
          updatedAt: new Date(position.timestamp).toISOString()
        };
        void this.reverseGeocode(coords.latitude, coords.longitude);
      },
      (error) => {
        this.current = {
          status: error.code === error.PERMISSION_DENIED ? "denied" : "error",
          label: error.code === error.PERMISSION_DENIED ? "GPS denied" : "GPS unavailable",
          error: error.message
        };
      },
      {
        enableHighAccuracy: true,
        maximumAge: 20_000,
        timeout: 12_000
      }
    );
  }

  snapshot(): GeoContext {
    return { ...this.current };
  }

  private async reverseGeocode(latitude: number, longitude: number): Promise<void> {
    const key = `${round(latitude, 2)}:${round(longitude, 2)}`;
    if (key === this.reverseKey) {
      return;
    }

    this.reverseKey = key;
    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", navigator.language || "en");

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`reverse geocode ${response.status}`);
      }

      const data = (await response.json()) as ReverseGeocodeResponse;
      const city = data.city || data.locality;
      const region = data.principalSubdivision;
      const country = data.countryName;
      this.current = {
        ...this.current,
        city,
        region,
        country,
        label: compactLabel([city, region, country]) || this.current.label
      };
    } catch (error) {
      this.current = {
        ...this.current,
        error: safeError(error)
      };
    }
  }
}

