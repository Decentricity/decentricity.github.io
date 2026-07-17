import { round } from "./utils.js";
export class BatterySensor {
    battery = null;
    async start() {
        const getBattery = navigator.getBattery;
        if (!getBattery) {
            return;
        }
        // Hardware migration: browser battery state becomes a charge controller / fuel gauge.
        this.battery = await getBattery.call(navigator);
    }
    snapshot() {
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
