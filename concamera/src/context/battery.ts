import type { BatteryContext } from "../types.js";
import { round } from "./utils.js";

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  level: number;
}

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

export class BatterySensor {
  private battery: BatteryManagerLike | null = null;

  async start(): Promise<void> {
    const getBattery = (navigator as NavigatorWithBattery).getBattery;
    if (!getBattery) {
      return;
    }

    // Hardware migration: browser battery state becomes a charge controller / fuel gauge.
    this.battery = await getBattery.call(navigator);
  }

  snapshot(): BatteryContext {
    if (!this.battery) {
      return {
        status: "unavailable"
      };
    }

    return {
      status: "granted",
      levelPercent: round(this.battery.level * 100),
      charging: this.battery.charging
    };
  }
}

