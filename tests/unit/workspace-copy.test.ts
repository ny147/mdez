import { describe, expect, it } from "vitest";

import { WORKSPACE_COPY, formatRelativeTime, getBookExportCopy } from "@/lib/workspace-copy";

describe("workspace copy", () => {
  it("defines one user-facing vocabulary", () => {
    expect(WORKSPACE_COPY).toMatchObject({
      library: "Library",
      books: "Books",
      pagesWithoutBook: "Pages without a book",
      recentPages: "Recent pages",
      importMarkdown: "Import Markdown"
    });
  });

  it("formats update times without raw timestamps", () => {
    const now = Date.parse("2026-08-08T12:00:00.000Z");

    expect(formatRelativeTime("2026-08-08T11:58:00.000Z", now)).toBe("2 minutes ago");
    expect(formatRelativeTime("2026-08-08T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("not-a-date", now)).toBe("Recently updated");
  });

  it("names the active book in export copy", () => {
    expect(getBookExportCopy(null)).toEqual({
      label: "Export book (.zip)",
      hint: "Open a book to export its Markdown pages and metadata.",
      disabled: true
    });
    expect(getBookExportCopy("Writing")).toEqual({
      label: "Export Writing (.zip)",
      hint: "Downloads the Markdown pages and metadata in Writing.",
      disabled: false
    });
  });
});
