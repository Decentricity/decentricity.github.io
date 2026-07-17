import type { AntiCameraContext, CameraPose, IndoorOutdoor, ManualCameraSettings } from "../types.js";

export type CaptureJobStatus =
  | "queued"
  | "capturing-source"
  | "collecting-context"
  | "detecting-faces"
  | "selecting-faces"
  | "generating"
  | "developing"
  | "complete"
  | "error";

export interface CaptureJob {
  id: string;
  sequence: number;
  createdAt: string;
  status: CaptureJobStatus;
  frozenPose: CameraPose;
  frozenSettings: ManualCameraSettings;
  mode: IndoorOutdoor;
  context?: AntiCameraContext | undefined;
  prompt?: string | undefined;
  imageDataUrl?: string | undefined;
  provider?: string | undefined;
  error?: string | undefined;
}

export interface CaptureQueueOptions {
  maxConcurrent?: number | undefined;
  maxQueuedCaptures?: number | undefined;
  run: (job: CaptureJob) => Promise<void>;
  onStatus?: ((job: CaptureJob) => void) | undefined;
  onChange?: (() => void) | undefined;
}

export class CaptureQueue {
  private readonly pending: CaptureJob[] = [];
  private readonly active = new Set<string>();
  private processing = false;
  readonly maxConcurrent: number;
  readonly maxQueuedCaptures: number;

  constructor(private readonly options: CaptureQueueOptions) {
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);
    this.maxQueuedCaptures = Math.max(this.maxConcurrent, options.maxQueuedCaptures ?? 10);
  }

  get activeCount(): number {
    return this.active.size;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get inFlightCount(): number {
    return this.active.size + this.pending.length;
  }

  hasCapacity(): boolean {
    return this.inFlightCount < this.maxQueuedCaptures;
  }

  enqueue(job: CaptureJob): boolean {
    if (!this.hasCapacity()) {
      return false;
    }

    this.setStatus(job, "queued");
    this.pending.push(job);
    this.options.onChange?.();
    void this.process();
    return true;
  }

  private async process(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      while (this.active.size < this.maxConcurrent && this.pending.length > 0) {
        const job = this.pending.shift();
        if (!job) {
          break;
        }

        this.active.add(job.id);
        this.options.onChange?.();
        void this.runJob(job);
      }
    } finally {
      this.processing = false;
    }
  }

  private async runJob(job: CaptureJob): Promise<void> {
    try {
      await this.options.run(job);
      if (job.status !== "error") {
        this.setStatus(job, "complete");
      }
    } catch (error) {
      job.error = error instanceof Error ? error.message : String(error);
      this.setStatus(job, "error");
    } finally {
      this.active.delete(job.id);
      this.options.onChange?.();
      void this.process();
    }
  }

  setStatus(job: CaptureJob, status: CaptureJobStatus): void {
    job.status = status;
    this.options.onStatus?.(job);
  }
}
