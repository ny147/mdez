import { describe, expect, it } from "vitest";
import {
  MAX_MARKDOWN_FILE_BYTES,
  fileNameToTitle,
  makeMarkdownFileName,
  titleFromBody
} from "@/lib/markdown";

describe("markdown helpers", () => {
  it("turns a markdown file name into a readable title", () => {
    expect(fileNameToTitle("daily-notes.md")).toBe("daily-notes");
    expect(fileNameToTitle("Project Plan.markdown")).toBe("Project Plan");
  });

  it("uses the first heading as a pasted document title", () => {
    expect(titleFromBody("# Launch Notes\n\nBody")).toBe("Launch Notes");
  });

  it("falls back to Untitled when pasted content has no heading", () => {
    expect(titleFromBody("plain text")).toBe("Untitled Document");
  });

  it("creates safe markdown file names", () => {
    expect(makeMarkdownFileName("Sprint / Plan?")).toBe("sprint-plan.md");
    expect(makeMarkdownFileName("")).toBe("untitled-document.md");
  });

  it("sets a five megabyte import warning threshold", () => {
    expect(MAX_MARKDOWN_FILE_BYTES).toBe(5 * 1024 * 1024);
  });
});
