import type { MotionContext, OrientationContext } from "../types.js";
import { clamp, round } from "./utils.js";

type PermissionRequester = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type WebKitOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

export class MotionSensors {
  private orientation: OrientationContext = {
    status: "pending",
    tilt: "Unknown"
  };

  private motion: MotionContext = {
    status: "pending",
    movement: "Unknown"
  };

  private listening = false;
  private samples: number[] = [];

  start(): void {
    if (this.listening) {
      return;
    }

    if (!("DeviceOrientationEvent" in window) && !("DeviceMotionEvent" in window)) {
      this.orientation = { status: "unavailable", tilt: "Unknown" };
      this.motion = { status: "unavailable", movement: "Unknown" };
      return;
    }

    // Hardware migration: browser orientation and motion events become a real IMU.
    window.addEventListener("deviceorientation", this.onOrientation);
    window.addEventListener("devicemotion", this.onMotion);
    this.listening = true;
  }

  async requestPermissions(): Promise<void> {
    const orientationPermission = (window.DeviceOrientationEvent as unknown as PermissionRequester).requestPermission;
    const motionPermission = (window.DeviceMotionEvent as unknown as PermissionRequester).requestPermission;
    const requests: Array<Promise<"granted" | "denied">> = [];

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
      this.orientation = { status: "denied", tilt: "Unknown" };
      this.motion = { status: "denied", movement: "Unknown" };
      return;
    }

    this.start();
  }

  orientationSnapshot(): OrientationContext {
    return { ...this.orientation };
  }

  motionSnapshot(): MotionContext {
    return { ...this.motion };
  }

  private onOrientation = (event: DeviceOrientationEvent): void => {
    const webkitEvent = event as WebKitOrientationEvent;
    const heading = webkitEvent.webkitCompassHeading ?? (event.alpha === null ? undefined : 360 - event.alpha);
    const beta = event.beta;
    const gamma = event.gamma;

    this.orientation = {
      status: "granted",
      headingDegrees: heading === undefined ? undefined : round((heading + 360) % 360),
      alpha: event.alpha,
      beta,
      gamma,
      tilt: this.tiltFrom(beta, gamma)
    };
  };

  private onMotion = (event: DeviceMotionEvent): void => {
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

  private tiltFrom(beta: number | null, gamma: number | null): OrientationContext["tilt"] {
    if (beta === null || gamma === null) {
      return "Unknown";
    }

    if (Math.abs(beta) < 18 && Math.abs(gamma) < 18) {
      return "Level";
    }

    if (beta > 25) {
      return "Up";
    }

    if (beta < -25) {
      return "Down";
    }

    if (gamma > 22) {
      return "Right";
    }

    if (gamma < -22) {
      return "Left";
    }

    return "Level";
  }

  private movementFrom(average: number | undefined, rotationRate: number | undefined): MotionContext["movement"] {
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

