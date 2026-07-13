import { describe, expect, it } from "vitest";

import { extractHeadings } from "@/lib/headings";

describe("extractHeadings", () => {
  it("extracts headings and suffixes duplicate slugs", () => {
    expect(extractHeadings("# Quiet shell\n\n## Mode behavior\n\n## Mode behavior")).toEqual([
      { depth: 1, text: "Quiet shell", id: "quiet-shell" },
      { depth: 2, text: "Mode behavior", id: "mode-behavior" },
      { depth: 2, text: "Mode behavior", id: "mode-behavior-2" }
    ]);
  });

  it("ignores headings inside fenced code", () => {
    expect(extractHeadings("# Visible\n\n~~~md\n# Hidden\n~~~")).toEqual([
      { depth: 1, text: "Visible", id: "visible" }
    ]);
  });
});
