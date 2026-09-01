import { describe, expect, it } from "vitest";

import { normalizeBookName, validateBookName } from "@/lib/book-names";
import type { Folder } from "@/types/content";

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "folder-1",
    name: "Book",
    parentId: null,
    order: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

describe("book names", () => {
  it("trims valid book names", () => {
    expect(normalizeBookName("  Research  ")).toBe("Research");
  });

  it.each(["", "   "])("rejects empty name %j", (name) => {
    expect(validateBookName(name, [], null)).toBe("Enter a book name.");
  });

  it("rejects names longer than 120 characters", () => {
    expect(validateBookName("a".repeat(121), [], null)).toBe("Book names must be 120 characters or fewer.");
  });

  it("rejects a case-insensitive sibling duplicate", () => {
    expect(validateBookName("research", [folder({ id: "a", name: "Research", parentId: null })], null))
      .toBe("A book named Research already exists here.");
  });

  it("allows the current book name during rename", () => {
    expect(validateBookName("Research", [folder({ id: "a", name: "Research" })], null, "a")).toBeNull();
  });
});
