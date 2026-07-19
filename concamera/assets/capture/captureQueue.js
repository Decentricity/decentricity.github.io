export class CaptureQueue {
    options;
    pending = [];
    active = new Set();
    processing = false;
    maxConcurrent;
    maxQueuedCaptures;
    constructor(options) {
        this.options = options;
        this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);
        this.maxQueuedCaptures = Math.max(this.maxConcurrent, options.maxQueuedCaptures ?? 10);
    }
    get activeCount() {
        return this.active.size;
    }
    get pendingCount() {
        return this.pending.length;
    }
    get inFlightCount() {
        return this.active.size + this.pending.length;
    }
    hasCapacity() {
        return this.inFlightCount < this.maxQueuedCaptures;
    }
    enqueue(job) {
        if (!this.hasCapacity()) {
            return false;
        }
        this.setStatus(job, "queued");
        this.pending.push(job);
        this.options.onChange?.();
        void this.process();
        return true;
    }
    async process() {
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
        }
        finally {
            this.processing = false;
        }
    }
    async runJob(job) {
        try {
            await this.options.run(job);
            if (job.status !== "error") {
                this.setStatus(job, "complete");
            }
        }
        catch (error) {
            job.error = error instanceof Error ? error.message : String(error);
            this.setStatus(job, "error");
        }
        finally {
            this.active.delete(job.id);
            this.options.onChange?.();
            void this.process();
        }
    }
    setStatus(job, status) {
        job.status = status;
        this.options.onStatus?.(job);
    }
}
