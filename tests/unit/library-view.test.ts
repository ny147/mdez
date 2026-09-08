import { describe, expect, it } from "vitest";
import { estimateReadingMinutes, getBookPath, getCoverVariant, selectLibraryView } from "@/lib/library-view";
import type { Document, Folder } from "@/types/content";

const timestamp = "2026-09-07T00:00:00.000Z";
const folder = (id: string, name: string, parentId: string | null, order = 0): Folder => ({
  id, name, parentId, order, createdAt: timestamp, updatedAt: timestamp
});
const page = (id: string, title: string, body: string, folderId: string | null, updatedAt = timestamp): Document => ({
  id, title, body, folderId, order: 0, createdAt: timestamp, updatedAt
});

describe("library view selectors", () => {
  const folders = [folder("root", "Work", null), folder("child", "Ideas", "root"), folder("other", "Archive", null, 1)];
  const documents = [
    page("a", "Roadmap", "quiet release notes", "child", "2026-09-07T03:00:00.000Z"),
    page("b", "Journal", "A BIG IDEA", null, "2026-09-07T03:00:00.000Z"),
    page("c", "Archive note", "done", "other", "2026-09-06T03:00:00.000Z")
  ];

  it("searches the whole workspace by trimmed case-folded page content and book name", () => {
    const pageResult = selectLibraryView({ documents, folders, selectedFolderId: "other", filter: "bookmarks", query: "  big idea ", bookmarkedIds: new Set(), lastOpenedDocumentId: null });
    expect(pageResult.pages.map((item) => item.id)).toEqual(["b"]);
    expect(pageResult.books).toEqual([]);

    const bookResult = selectLibraryView({ documents, folders, selectedFolderId: "child", filter: "all", query: " WORK ", bookmarkedIds: new Set(), lastOpenedDocumentId: null });
    expect(bookResult.books.map((item) => item.id)).toEqual(["root"]);
    expect(bookResult.pages).toEqual([]);
  });

  it("keeps My library, a selected book, Recent, Bookmarks, and Unsorted distinct", () => {
    const input = { documents, folders, selectedFolderId: null, query: "", bookmarkedIds: new Set(["c"]), lastOpenedDocumentId: "a" } as const;
    expect(selectLibraryView({ ...input, filter: "all" }).books.map((item) => item.id)).toEqual(["root", "other"]);
    expect(selectLibraryView({ ...input, selectedFolderId: "root", filter: "all" }).books.map((item) => item.id)).toEqual(["child"]);
    expect(selectLibraryView({ ...input, filter: "recent" }).pages.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(selectLibraryView({ ...input, filter: "bookmarks" }).pages.map((item) => item.id)).toEqual(["c"]);
    expect(selectLibraryView({ ...input, filter: "unsorted" }).pages.map((item) => item.id)).toEqual(["b"]);
    expect(selectLibraryView({ ...input, filter: "unsorted" }).books).toEqual([]);
    expect(selectLibraryView({ ...input, filter: "all" }).resumePage?.id).toBe("a");
    expect(selectLibraryView({ ...input, lastOpenedDocumentId: "deleted", filter: "all" }).resumePage).toBeNull();
  });

  it("returns stable paths and deterministic helpers for edge cases", () => {
    expect(getBookPath("child", folders)).toBe("Work / Ideas");
    expect(getBookPath(null, folders)).toBe("Unsorted pages");
    expect(getBookPath("missing", folders)).toBe("Missing book");
    expect(getBookPath("cycle-a", [folder("cycle-a", "A", "cycle-b"), folder("cycle-b", "B", "cycle-a")])).toBe("B / A");
    expect(getCoverVariant("root")).toBe(getCoverVariant("root"));
    expect(getCoverVariant("root")).toBeGreaterThanOrEqual(0);
    expect(getCoverVariant("root")).toBeLessThanOrEqual(3);
    expect(estimateReadingMinutes("")).toBe(1);
    expect(estimateReadingMinutes(Array.from({ length: 401 }, () => "word").join(" "))).toBe(3);
  });
});
