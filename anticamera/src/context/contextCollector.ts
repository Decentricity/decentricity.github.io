import type { AntiCameraContext, CameraPose, IndoorOutdoor } from "../types.js";
import { AmbientAudioSensor } from "./audio.js";
import { BatterySensor } from "./battery.js";
import { DeviceSensor } from "./device.js";
import { GpsSensor } from "./gps.js";
import { MotionSensors } from "./sensors.js";
import { TimeSensor } from "./time.js";
import { WeatherService } from "./weather.js";

export class ContextCollector {
  private readonly audio = new AmbientAudioSensor();
  private readonly battery = new BatterySensor();
  private readonly device = new DeviceSensor();
  private readonly gps = new GpsSensor();
  private readonly motion = new MotionSensors();
  private readonly time = new TimeSensor();
  private readonly weather = new WeatherService();

  async startPassiveCollection(): Promise<void> {
    this.gps.start();
    this.motion.start();
    this.device.start();
    await this.battery.start().catch(() => undefined);

    void this.audio.start();
  }

  async primeFromUserGesture(): Promise<void> {
    this.gps.start();
    await Promise.allSettled([
      this.motion.requestPermissions(),
      this.audio.start(),
      this.battery.start()
    ]);
  }

  freezeCameraPose(): CameraPose {
    return this.motion.freezePose(Date.now());
  }

  async snapshot(mode: IndoorOutdoor, frozenPose?: CameraPose): Promise<AntiCameraContext> {
    const now = new Date(frozenPose?.capturedAt ?? Date.now());
    const time = this.time.snapshot(now);
    const location = this.gps.snapshot();
    const weather = await this.weather.snapshot(location);
    const cameraPose = frozenPose ?? this.motion.poseSnapshot(now.getTime());

    return {
      capturedAt: now.toISOString(),
      mode,
      time,
      location,
      weather,
      cameraPose,
      orientation: this.motion.orientationSnapshot(),
      motion: this.motion.motionSnapshot(),
      audio: this.audio.snapshot(),
      battery: this.battery.snapshot(),
      device: this.device.snapshot()
    };
  }
}
