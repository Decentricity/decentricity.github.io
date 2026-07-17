export class DeviceSensor {
    ambientLightLux;
    start() {
        const AmbientLight = window.AmbientLightSensor;
        if (!AmbientLight) {
            return;
        }
        try {
            const sensor = new AmbientLight();
            sensor.addEventListener("reading", () => {
                this.ambientLightLux = sensor.illuminance;
            });
            sensor.start();
        }
        catch {
            this.ambientLightLux = undefined;
        }
    }
    snapshot() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const connection = navigator.connection;
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
    deviceType() {
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
