import { describe, expect, it } from "vitest";
import { buildPerformanceFixture, fixtureSizes } from "../performance/support/fixtures";
import { percentile, serializePerformanceSample } from "../performance/support/metrics";
import { GROUP_LIMITS } from "@/types/key-group";

describe("performance fixtures", () => {
  for (const [size, [books, pages, bytes]] of Object.entries(fixtureSizes)) {
    it(`builds exact, deterministic ${size} data within group limits`, () => {
      const snapshot = buildPerformanceFixture(size as keyof typeof fixtureSizes);
      expect(snapshot).toEqual(buildPerformanceFixture(size as keyof typeof fixtureSizes));
      expect(snapshot.folders).toHaveLength(books);
      expect(snapshot.documents).toHaveLength(pages);
      expect(new Set(snapshot.documents.map((item) => item.id)).size).toBe(pages);
      expect(snapshot.folders.every((item) => item.parentId === null)).toBe(true);
      const ids = new Set(snapshot.folders.map((item) => item.id));
      let total = 0;
      for (const document of snapshot.documents) {
        expect(document.folderId === null || ids.has(document.folderId)).toBe(true);
        const actual = new TextEncoder().encode(document.body).length;
        expect(actual).toBe(bytes);
        expect(actual).toBeLessThanOrEqual(GROUP_LIMITS.pageBytes);
        total += actual;
      }
      expect(total).toBeLessThan(GROUP_LIMITS.totalBytes);
    });
  }
});

it("calculates immutable nearest-rank percentiles and rejects invalid durations", () => {
  const values = [9, 1, 5, 3];
  expect(percentile(values, 0.5)).toBe(3);
  expect(percentile(values, 0.95)).toBe(9);
  expect(percentile([], 0.95)).toBeNull();
  expect(values).toEqual([9, 1, 5, 3]);
  for (const invalid of [-1, NaN, Infinity]) expect(() => percentile([invalid], 0.95)).toThrow();
});

it("exports only fixed metric fields and rejects invalid durations", () => {
  const sample = { action: "switch", workspaceKind: "group", fixture: "small", mode: "mock", profile: "unthrottled", run: 1, outcome: "success", paintMs: 10, feedbackMs: null, confirmedMs: null, key: "FORBIDDEN_SECRET", body: "FORBIDDEN_BODY" } as const;
  const serialized = serializePerformanceSample(sample);
  expect(serialized).not.toContain("FORBIDDEN");
  expect(JSON.parse(serialized).paintMs).toBe(10);
  expect(() => serializePerformanceSample({ ...sample, paintMs: -1 })).toThrow();
  expect(() => serializePerformanceSample({ ...sample, action: "FORBIDDEN_SECRET" } as never)).toThrow();
});
