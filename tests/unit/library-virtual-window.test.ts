import { describe, expect, it } from "vitest";

import { mergeRetainedIndices } from "@/lib/library-virtual-window";

describe("mergeRetainedIndices", () => {
  it("keeps a distant retained row without filling the gap", () => {
    expect(mergeRetainedIndices(500, 520, 1000, [0])).toEqual([
      0,
      ...Array.from({ length: 20 }, (_, index) => 500 + index)
    ]);
  });

  it("sorts, deduplicates, and bounds retained indices", () => {
    expect(mergeRetainedIndices(2, 5, 6, [5, 1, 2, 1, -1, 9])).toEqual([1, 2, 3, 4, 5]);
  });
});
