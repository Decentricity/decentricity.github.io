import { CascadingReverseGeocoder, applyAccuracyToReverseGeocode, cloneReverseGeocode, formatLocationLabel, haversineMeters, needsReverseRefresh } from "./reverseGeocoder.js";
import { round, safeError } from "./utils.js";
export class GpsSensor {
    reverseGeocoder;
    current = {
        status: "pending",
        label: "Waiting for GPS",
        reverseGeocodeStatus: "pending"
    };
    watchId = null;
    reverseCache = null;
    reverseDebounceId = null;
    activeReverse = null;
    reverseDebounceMs;
    reverseTimeoutMs;
    reverseStaleMs;
    reverseMoveThresholdMeters;
    reverseReuseDistanceMeters;
    constructor(reverseGeocoder = new CascadingReverseGeocoder(), options = {}) {
        this.reverseGeocoder = reverseGeocoder;
        this.reverseDebounceMs = options.reverseDebounceMs ?? 650;
        this.reverseTimeoutMs = options.reverseTimeoutMs ?? 8_000;
        this.reverseStaleMs = options.reverseStaleMs ?? 7 * 60_000;
        this.reverseMoveThresholdMeters = options.reverseMoveThresholdMeters ?? 35;
        this.reverseReuseDistanceMeters = options.reverseReuseDistanceMeters ?? 90;
    }
    start() {
        if (!("geolocation" in navigator)) {
            this.current = {
                status: "unavailable",
                label: "No browser GPS",
                reverseGeocodeStatus: "unavailable"
            };
            return;
        }
        if (this.watchId !== null) {
            return;
        }
        // Hardware migration: browser GPS becomes a dedicated GNSS module on the physical device.
        this.watchId = navigator.geolocation.watchPosition((position) => {
            const coords = position.coords;
            const latitude = round(coords.latitude, 6) ?? coords.latitude;
            const longitude = round(coords.longitude, 6) ?? coords.longitude;
            const accuracy = round(coords.accuracy, 1);
            const reusableReverse = this.reusableReverseGeocode(latitude, longitude, accuracy);
            this.current = {
                status: "granted",
                latitude,
                longitude,
                altitude: coords.altitude,
                accuracy,
                heading: coords.heading,
                speed: coords.speed,
                label: formatLocationLabel({ latitude, longitude, reverseGeocode: reusableReverse }),
                city: reusableReverse?.address.city || this.current.city,
                region: reusableReverse?.address.region || this.current.region,
                country: reusableReverse?.address.country || this.current.country,
                reverseGeocode: reusableReverse,
                reverseGeocodeStatus: this.activeReverse ? "pending" : reusableReverse ? "granted" : "pending",
                reverseGeocodeError: this.current.reverseGeocodeError,
                updatedAt: new Date(position.timestamp).toISOString()
            };
            this.scheduleReverseGeocode(latitude, longitude, accuracy);
        }, (error) => {
            this.current = {
                status: error.code === error.PERMISSION_DENIED ? "denied" : "error",
                label: error.code === error.PERMISSION_DENIED ? "GPS denied" : "GPS unavailable",
                reverseGeocodeStatus: error.code === error.PERMISSION_DENIED ? "denied" : "error",
                error: error.message
            };
        }, {
            enableHighAccuracy: true,
            maximumAge: 20_000,
            timeout: 12_000
        });
    }
    async snapshot(options = {}) {
        const waitMs = options.waitForReverseGeocodeMs ?? 0;
        if (waitMs > 0 && this.activeReverse) {
            await waitForSettled(this.activeReverse.settled, waitMs).catch(() => undefined);
        }
        return cloneGeoContext(this.current);
    }
    scheduleReverseGeocode(latitude, longitude, accuracy) {
        if (!needsReverseRefresh({
            currentLatitude: latitude,
            currentLongitude: longitude,
            currentAccuracy: accuracy,
            cached: this.reverseCache,
            now: Date.now(),
            staleMs: this.reverseStaleMs,
            moveThresholdMeters: this.reverseMoveThresholdMeters
        })) {
            return;
        }
        this.current = {
            ...this.current,
            reverseGeocodeStatus: "pending"
        };
        if (this.reverseDebounceId !== null) {
            window.clearTimeout(this.reverseDebounceId);
        }
        this.reverseDebounceId = window.setTimeout(() => {
            this.reverseDebounceId = null;
            this.runReverseGeocode(latitude, longitude, accuracy);
        }, this.reverseDebounceMs);
    }
    runReverseGeocode(latitude, longitude, accuracy) {
        this.activeReverse?.controller.abort();
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), this.reverseTimeoutMs);
        const settled = this.reverseGeocoder.reverse(latitude, longitude, {
            language: navigator.language || "en",
            signal: controller.signal
        }).then((result) => {
            const currentLatitude = this.current.latitude;
            const currentLongitude = this.current.longitude;
            if (currentLatitude === undefined || currentLongitude === undefined) {
                return;
            }
            const moved = haversineMeters(latitude, longitude, currentLatitude, currentLongitude);
            if (moved > this.reverseReuseDistanceMeters) {
                return;
            }
            const location = applyAccuracyToReverseGeocode(result, accuracy);
            this.reverseCache = {
                latitude,
                longitude,
                resolvedAt: Date.now(),
                location,
                ...(accuracy === undefined ? {} : { accuracy })
            };
            this.current = {
                ...this.current,
                label: formatLocationLabel({
                    latitude: currentLatitude,
                    longitude: currentLongitude,
                    reverseGeocode: location
                }),
                city: location.address.city || undefined,
                region: location.address.region || undefined,
                country: location.address.country || undefined,
                reverseGeocode: location,
                reverseGeocodeStatus: "granted",
                reverseGeocodeError: undefined
            };
        }).catch((error) => {
            this.current = {
                ...this.current,
                reverseGeocodeStatus: this.current.reverseGeocode ? "error" : "error",
                reverseGeocodeError: safeError(error),
                label: formatLocationLabel(this.current)
            };
        }).finally(() => {
            window.clearTimeout(timeoutId);
            if (this.activeReverse?.controller === controller) {
                this.activeReverse = null;
            }
        });
        this.activeReverse = {
            controller,
            settled
        };
    }
    reusableReverseGeocode(latitude, longitude, accuracy) {
        const cached = this.reverseCache;
        if (!cached) {
            return this.current.reverseGeocode;
        }
        const distance = haversineMeters(latitude, longitude, cached.latitude, cached.longitude);
        if (distance > this.reverseReuseDistanceMeters) {
            return undefined;
        }
        return applyAccuracyToReverseGeocode(cached.location, accuracy);
    }
}
function cloneGeoContext(context) {
    return {
        ...context,
        reverseGeocode: context.reverseGeocode ? cloneReverseGeocode(context.reverseGeocode) : undefined
    };
}
function waitForSettled(promise, timeoutMs) {
    let timeoutId;
    const timeout = new Promise((resolve) => {
        timeoutId = window.setTimeout(resolve, timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
        }
    });
}
