import { describe, expect, it, vi } from "vitest";
import { createOrderedSaveQueue } from "./ordered-save-queue";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createOrderedSaveQueue", () => {
  it("never starts snapshot 2 before snapshot 1 settles", async () => {
    const first = deferred<void>();
    const calls: number[] = [];
    const queue = createOrderedSaveQueue(async (value: number) => {
      calls.push(value);
      if (value === 1) await first.promise;
    });

    const one = queue.enqueue(1);
    const two = queue.enqueue(2);
    await Promise.resolve();
    expect(calls).toEqual([1]);

    first.resolve();
    await Promise.all([one, two]);
    expect(calls).toEqual([1, 2]);
  });

  it("rejects queued snapshots after a failed save instead of writing stale descendants", async () => {
    const save = vi.fn(async (value: number) => {
      if (value === 1) throw new Error("network");
    });
    const queue = createOrderedSaveQueue(save);

    const one = queue.enqueue(1);
    const two = queue.enqueue(2);

    await expect(one).rejects.toThrow("network");
    await expect(two).rejects.toThrow("network");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("allows new snapshots after reset following a failure", async () => {
    let shouldFail = true;
    const save = vi.fn(async () => {
      if (shouldFail) throw new Error("network");
    });
    const queue = createOrderedSaveQueue(save);

    await expect(queue.enqueue(1)).rejects.toThrow("network");
    shouldFail = false;
    queue.reset();

    await expect(queue.enqueue(2)).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(2);
  });
});
