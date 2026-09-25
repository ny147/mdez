import { describe, expect, it } from "vitest";

import { splitSafeArchivePath } from "@/lib/archive-path";

describe("safe archive paths", () => {
  it("returns normalized segments for a relative forward-slash path", () => {
    expect(splitSafeArchivePath("books/notes/page.md")).toEqual(["books", "notes", "page.md"]);
  });

  it.each([
    "",
    "/absolute.md",
    "C:/drive.md",
    "C:page.md",
    "C:folder/page.md",
    "books\\page.md",
    "books/../page.md",
    "books/./page.md",
    "books//page.md",
    "books/bad\nname.md"
  ])("rejects unsafe path %j", (path) => {
    expect(() => splitSafeArchivePath(path)).toThrow("Unsafe archive path");
  });
});
