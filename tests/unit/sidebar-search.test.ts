import { describe, expect, it } from "vitest";

import { normalizeSidebarQuery, searchSidebar } from "@/lib/sidebar-search";
import type { Document, Folder } from "@/types/content";

const timestamp = "2026-09-02T00:00:00.000Z";

function folder(overrides: Partial<Folder>): Folder {
  return {
    id: "folder",
    name: "Book",
    parentId: null,
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function page(overrides: Partial<Document>): Document {
  return {
    id: "page",
    title: "Page",
    body: "",
    folderId: null,
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

const folders = [
  folder({ id: "writing", name: "Wríting" }),
  folder({ id: "drafts", name: "Drafts", parentId: "writing" })
];

const documents = [
  page({ id: "old", title: "Alpha notes", updatedAt: "2026-09-01T00:00:00.000Z" }),
  page({ id: "new", title: "Launch plan", body: "alpha only in body", folderId: "drafts" })
];

describe("sidebar search", () => {
  it("normalizes case, diacritics, and repeated whitespace", () => {
    expect(normalizeSidebarQuery("  WRÍTING   room  ")).toBe("writing room");
  });

  it("groups book-name and page-title matches without searching bodies", () => {
    const writing = searchSidebar(folders, documents, "writing");
    expect(writing.books.map((result) => result.folder.id)).toEqual(["writing"]);
    expect(writing.pages).toEqual([]);

    const alpha = searchSidebar(folders, documents, "alpha");
    expect(alpha.pages.map((result) => result.document.id)).toEqual(["old"]);
  });

  it("returns a nested book path and most-recent pages first", () => {
    const result = searchSidebar(
      folders,
      [
        page({ id: "older", title: "Plan older", folderId: "drafts", updatedAt: "2026-08-30T00:00:00.000Z" }),
        page({ id: "newer", title: "Plan newer", folderId: "drafts", updatedAt: "2026-09-02T00:00:00.000Z" })
      ],
      "plan"
    );

    expect(result.pages.map((item) => item.document.id)).toEqual(["newer", "older"]);
    expect(result.pages[0]?.bookPath).toBe("Wríting / Drafts");
    expect(result.totalPageMatches).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it("reports totals and caps visible results", () => {
    const manyPages = Array.from({ length: 51 }, (_, index) =>
      page({ id: `page-${index}`, title: `Match ${index}`, order: index })
    );

    const result = searchSidebar([], manyPages, "match");

    expect(result.pages).toHaveLength(50);
    expect(result.totalPageMatches).toBe(51);
    expect(result.truncated).toBe(true);
    expect(result.pages[0]?.bookPath).toBe("Pages without a book");
  });
});
