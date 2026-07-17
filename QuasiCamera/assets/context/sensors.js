import { aimLabelForPitch, cameraPoseFromDeviceOrientation, cameraPoseWithFreshness, currentScreenOrientationDeg, emptyCameraPose, freezeCameraPose, parseDebugPose, smoothCameraPose } from "./cameraPose.js";
import { clamp, round } from "./utils.js";
export class MotionSensors {
    simulator = parseDebugPose(window.location.search);
    cameraPose = this.simulator.enabled
        ? this.simulator.pose
        : emptyCameraPose();
    orientation = {
        status: "pending",
        aim: "Unknown"
    };
    motion = {
        status: "pending",
        movement: "Unknown"
    };
    listening = false;
    samples = [];
    start() {
        if (this.listening) {
            return;
        }
        if (this.simulator.enabled) {
            this.orientation = {
                status: "granted",
                aim: aimLabelForPitch(this.simulator.pose.pitchDeg),
                sampleAgeMs: 0
            };
            this.motion = {
                status: "granted",
                movement: "Still"
            };
            this.listening = true;
            return;
        }
        if (!("DeviceOrientationEvent" in window) && !("DeviceMotionEvent" in window)) {
            this.orientation = { status: "unavailable", aim: "Unknown" };
            this.motion = { status: "unavailable", movement: "Unknown" };
            return;
        }
        // Hardware migration: browser orientation and motion events become a real IMU.
        window.addEventListener("deviceorientation", this.onOrientation);
        window.addEventListener("devicemotion", this.onMotion);
        this.listening = true;
    }
    async requestPermissions() {
        const orientationPermission = window.DeviceOrientationEvent.requestPermission;
        const motionPermission = window.DeviceMotionEvent.requestPermission;
        const requests = [];
        if (orientationPermission) {
            requests.push(orientationPermission.call(window.DeviceOrientationEvent));
        }
        if (motionPermission) {
            requests.push(motionPermission.call(window.DeviceMotionEvent));
        }
        if (!requests.length) {
            this.start();
            return;
        }
        const results = await Promise.allSettled(requests);
        const denied = results.some((result) => result.status === "fulfilled" && result.value === "denied");
        if (denied) {
            this.orientation = { status: "denied", aim: "Unknown" };
            this.motion = { status: "denied", movement: "Unknown" };
            return;
        }
        this.start();
    }
    orientationSnapshot() {
        const now = Date.now();
        return {
            ...this.orientation,
            sampleAgeMs: Math.max(0, now - this.cameraPose.capturedAt),
            aim: aimLabelForPitch(this.poseSnapshot(now).pitchDeg)
        };
    }
    motionSnapshot() {
        return { ...this.motion };
    }
    poseSnapshot(now = Date.now()) {
        if (this.simulator.enabled) {
            return freezeCameraPose(this.simulator.pose, now);
        }
        return cameraPoseWithFreshness(this.cameraPose, now);
    }
    freezePose(now = Date.now()) {
        return freezeCameraPose(this.poseSnapshot(now), now);
    }
    onOrientation = (event) => {
        const capturedAt = Date.now();
        const webkitEvent = event;
        const measured = cameraPoseFromDeviceOrientation({
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            webkitCompassHeading: webkitEvent.webkitCompassHeading,
            screenOrientationDeg: currentScreenOrientationDeg(),
            capturedAt
        });
        this.cameraPose = this.cameraPose.pitchDeg === null && this.cameraPose.rollDeg === null
            ? measured
            : smoothCameraPose(this.cameraPose, measured);
        this.orientation = {
            status: "granted",
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
            webkitCompassHeading: webkitEvent.webkitCompassHeading,
            sampleAgeMs: 0,
            aim: aimLabelForPitch(this.cameraPose.pitchDeg)
        };
    };
    onMotion = (event) => {
        const acceleration = event.accelerationIncludingGravity;
        const rotation = event.rotationRate;
        const magnitude = acceleration
            ? Math.sqrt((acceleration.x || 0) ** 2 + (acceleration.y || 0) ** 2 + (acceleration.z || 0) ** 2)
            : undefined;
        const normalized = magnitude === undefined ? undefined : Math.abs(magnitude - 9.81);
        if (normalized !== undefined) {
            this.samples.push(normalized);
            this.samples = this.samples.slice(-24);
        }
        const average = this.samples.length
            ? this.samples.reduce((sum, value) => sum + value, 0) / this.samples.length
            : undefined;
        const rotationRate = rotation
            ? Math.abs(rotation.alpha || 0) + Math.abs(rotation.beta || 0) + Math.abs(rotation.gamma || 0)
            : undefined;
        this.motion = {
            status: "granted",
            accelerationMagnitude: round(normalized, 2),
            rotationRate: round(rotationRate, 2),
            movement: this.movementFrom(average, rotationRate)
        };
    };
    movementFrom(average, rotationRate) {
        if (average === undefined) {
            return "Unknown";
        }
        const combined = average + clamp((rotationRate || 0) / 100, 0, 3);
        if (combined < 0.18) {
            return "Still";
        }
        if (combined < 0.9) {
            return "Handheld";
        }
        if (combined < 2.2) {
            return "Walking";
        }
        return "Riding";
    }
}
