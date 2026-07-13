import { describe, expect, it } from "vitest";
import {
  MAX_MARKDOWN_FILE_BYTES,
  MAX_MARKDOWN_FILE_SLUG_LENGTH,
  fileNameToTitle,
  isMarkdownFile,
  makeMarkdownFileName,
  titleFromBody
} from "@/lib/markdown";

describe("markdown helpers", () => {
  it("turns a markdown file name into a readable title", () => {
    expect(fileNameToTitle("daily-notes.md")).toBe("daily-notes");
    expect(fileNameToTitle("Project Plan.markdown")).toBe("Project Plan");
  });

  it("uses the first heading as a pasted page title", () => {
    expect(titleFromBody("# Launch Notes\n\nBody")).toBe("Launch Notes");
  });

  it("uses the first ATX heading level one through six as a pasted page title", () => {
    expect(titleFromBody("Intro\n\n### Import Plan\n\nBody")).toBe("Import Plan");
  });

  it("falls back to Untitled when pasted content has no heading", () => {
    expect(titleFromBody("plain text")).toBe("untitled.md");
  });

  it("creates safe markdown file names", () => {
    expect(makeMarkdownFileName("Sprint / Plan?")).toBe("sprint-plan.md");
    expect(makeMarkdownFileName("")).toBe("untitled.md");
  });

  it("caps generated markdown filename slugs", () => {
    const fileName = makeMarkdownFileName(`${"Release ".repeat(20)}!!!`);
    const slug = fileName.replace(/\.md$/, "");

    expect(slug.length).toBeLessThanOrEqual(MAX_MARKDOWN_FILE_SLUG_LENGTH);
    expect(fileName).toMatch(/\.md$/);
    expect(fileName).not.toMatch(/-\.md$/);
  });

  it("detects markdown files by extension or MIME type", () => {
    expect(isMarkdownFile(new File([""], "NOTES.MD"))).toBe(true);
    expect(isMarkdownFile(new File([""], "project.markdown"))).toBe(true);
    expect(isMarkdownFile(new File([""], "plain.txt"))).toBe(false);
    expect(isMarkdownFile(new File([""], "upload", { type: "text/markdown" }))).toBe(true);
    expect(isMarkdownFile(new File([""], "upload", { type: "TEXT/X-MARKDOWN" }))).toBe(true);
  });

  it("sets a five megabyte import warning threshold", () => {
    expect(MAX_MARKDOWN_FILE_BYTES).toBe(5 * 1024 * 1024);
  });
});
