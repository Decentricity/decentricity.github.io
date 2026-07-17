import type { DeviceContext } from "../types.js";

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
    type?: string;
  };
}

type AmbientLightSensorLike = {
  illuminance?: number;
  addEventListener: (type: "reading" | "error", listener: () => void) => void;
  start: () => void;
};

type AmbientLightConstructor = new () => AmbientLightSensorLike;

export class DeviceSensor {
  private ambientLightLux: number | undefined;

  start(): void {
    const AmbientLight = (window as unknown as { AmbientLightSensor?: AmbientLightConstructor }).AmbientLightSensor;
    if (!AmbientLight) {
      return;
    }

    try {
      const sensor = new AmbientLight();
      sensor.addEventListener("reading", () => {
        this.ambientLightLux = sensor.illuminance;
      });
      sensor.start();
    } catch {
      this.ambientLightLux = undefined;
    }
  }

  snapshot(): DeviceContext {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const connection = (navigator as NavigatorWithConnection).connection;

    return {
      language: navigator.language,
      languages: [...navigator.languages],
      deviceType: this.deviceType(),
      viewport: {
        width,
        height,
        pixelRatio: window.devicePixelRatio || 1,
        orientation: height >= width ? "portrait" : "landscape"
      },
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      screenBrightness: "unavailable",
      ambientLightLux: this.ambientLightLux,
      connectionType: connection?.effectiveType || connection?.type,
      userAgent: navigator.userAgent
    };
  }

  private deviceType(): DeviceContext["deviceType"] {
    const width = Math.min(window.innerWidth, screen.width || window.innerWidth);
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    if (coarse && width < 700) {
      return "phone";
    }

    if (coarse) {
      return "tablet";
    }

    return "desktop";
  }
}

