import { describe, expect, it, vi } from "vitest";

import { LatestSaveQueue } from "@/lib/latest-save-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("LatestSaveQueue", () => {
  it("serializes one key and persists only the newest waiting value", async () => {
    const first = deferred<string>();
    const persist = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce("saved newest");
    const queue = new LatestSaveQueue(persist);

    const firstResult = queue.enqueue("page-1", "first");
    const supersededResult = queue.enqueue("page-1", "second");
    const newestResult = queue.enqueue("page-1", "newest");
    first.resolve("saved first");

    await expect(firstResult).resolves.toBe("saved first");
    await expect(supersededResult).resolves.toBeNull();
    await expect(newestResult).resolves.toBe("saved newest");
    expect(persist).toHaveBeenNthCalledWith(1, "page-1", "first");
    expect(persist).toHaveBeenNthCalledWith(2, "page-1", "newest");
  });

  it("rejects the failed value and continues with the newest waiting value", async () => {
    const first = deferred<string>();
    const persist = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce("recovered");
    const queue = new LatestSaveQueue(persist);

    const failed = queue.enqueue("page-1", "bad");
    const recovered = queue.enqueue("page-1", "good");
    const failedExpectation = expect(failed).rejects.toThrow("offline");
    first.reject(new Error("offline"));

    await failedExpectation;
    await expect(recovered).resolves.toBe("recovered");
  });
});
