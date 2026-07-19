import assert from "node:assert/strict";
import { test } from "node:test";
import { CaptureQueue } from "../assets/capture/captureQueue.js";
import { DEFAULT_MANUAL_SETTINGS } from "../assets/context/manualSettings.js";

test("capture queue creates FIFO work with a concurrency limit", async () => {
  const first = deferred();
  const second = deferred();
  const third = deferred();
  const started = [];
  const completed = [];
  const queue = new CaptureQueue({
    maxConcurrent: 1,
    run: async (job) => {
      started.push(job.id);
      await { first, second, third }[job.id].promise;
      completed.push(job.id);
    }
  });

  assert.equal(queue.enqueue(job("first")), true);
  assert.equal(queue.enqueue(job("second")), true);
  assert.equal(queue.enqueue(job("third")), true);
  await waitFor(() => started.length === 1);
  assert.deepEqual(started, ["first"]);
  assert.equal(queue.activeCount, 1);
  assert.equal(queue.pendingCount, 2);

  first.resolve();
  await waitFor(() => started.length === 2);
  assert.deepEqual(started, ["first", "second"]);
  assert.deepEqual(completed, ["first"]);

  second.resolve();
  await waitFor(() => started.length === 3);
  assert.deepEqual(started, ["first", "second", "third"]);

  third.resolve();
  await waitFor(() => completed.length === 3);
  assert.deepEqual(completed, ["first", "second", "third"]);
  assert.equal(queue.inFlightCount, 0);
});

test("capture queue does not exceed configured concurrent requests", async () => {
  const gates = [deferred(), deferred(), deferred()];
  let active = 0;
  let maxActive = 0;
  const queue = new CaptureQueue({
    maxConcurrent: 2,
    run: async (job) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gates[Number(job.id)].promise;
      active -= 1;
    }
  });

  queue.enqueue(job("0"));
  queue.enqueue(job("1"));
  queue.enqueue(job("2"));
  await waitFor(() => queue.activeCount === 2);
  assert.equal(maxActive, 2);
  assert.equal(queue.pendingCount, 1);

  gates[0].resolve();
  await waitFor(() => queue.activeCount === 2 && queue.pendingCount === 0);
  gates[1].resolve();
  gates[2].resolve();
  await waitFor(() => queue.inFlightCount === 0);
  assert.equal(maxActive, 2);
});

test("capture queue continues after an individual job failure", async () => {
  const statuses = [];
  const started = [];
  const queue = new CaptureQueue({
    maxConcurrent: 1,
    run: async (captureJob) => {
      started.push(captureJob.id);
      if (captureJob.id === "bad") {
        throw new Error("provider failed");
      }
    },
    onStatus: (captureJob) => {
      statuses.push([captureJob.id, captureJob.status, captureJob.error]);
    }
  });

  queue.enqueue(job("first"));
  queue.enqueue(job("bad"));
  queue.enqueue(job("last"));
  await waitFor(() => queue.inFlightCount === 0);

  assert.deepEqual(started, ["first", "bad", "last"]);
  assert.ok(statuses.some(([id, status]) => id === "first" && status === "complete"));
  assert.ok(statuses.some(([id, status, error]) => id === "bad" && status === "error" && /provider failed/.test(error)));
  assert.ok(statuses.some(([id, status]) => id === "last" && status === "complete"));
});

test("capture queue enforces capacity across active and pending jobs", async () => {
  const hold = deferred();
  const queue = new CaptureQueue({
    maxConcurrent: 1,
    maxQueuedCaptures: 2,
    run: async () => {
      await hold.promise;
    }
  });

  assert.equal(queue.enqueue(job("one")), true);
  assert.equal(queue.enqueue(job("two")), true);
  assert.equal(queue.hasCapacity(), false);
  assert.equal(queue.enqueue(job("three")), false);

  hold.resolve();
  await waitFor(() => queue.inFlightCount === 0);
  assert.equal(queue.hasCapacity(), true);
});

function job(id) {
  return {
    id,
    sequence: Number(id.replace(/\D/g, "")) || 0,
    createdAt: "2026-07-17T00:00:00.000Z",
    status: "queued",
    frozenPose: {
      azimuthDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      screenOrientationDeg: 0,
      confidence: "high",
      capturedAt: 0
    },
    frozenSettings: { ...DEFAULT_MANUAL_SETTINGS },
    mode: "outdoor"
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(predicate, timeoutMs = 500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      assert.fail("Timed out waiting for queue condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
