import type { WorkspaceRestorePlan } from "@/types/backup";

export const backupPlan: WorkspaceRestorePlan = {
  parsed: {
    manifest: { format: "mdez-library-backup", schemaVersion: 1, appVersion: "0.1.0", exportedAt: "2026-09-22T00:00:00.000Z", books: [], pages: [], bookmarks: [], githubSources: [] },
    pages: [{ metadata: { id: "page", title: "Secret", bookId: null, order: 0, createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z", path: "unsorted/secret.md", byteLength: 10, sha256: "a".repeat(64) }, body: "private markdown body" }],
    totalMarkdownBytes: 1024
  },
  baseSignature: "signature",
  books: [
    { id: "1", name: "Notes", order: 0, createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z", restoredName: "Notes (restored)", renamed: true },
    { id: "2", name: "Empty", order: 1, createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z", restoredName: "Empty", renamed: false },
    { id: "3", name: "Research", order: 2, createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z", restoredName: "Research", renamed: false }
  ],
  sources: [{ id: "source", owner: "openai", repository: "codex", normalizedUrl: "https://github.com/openai/codex", branch: "main", rootBookId: "1", lastRefreshedAt: "2026-09-22T00:00:00.000Z", createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z", action: "detach" }],
  summary: { bookCount: 3, emptyBookCount: 1, pageCount: 4, unsortedPageCount: 1, bookmarkCount: 1, totalMarkdownBytes: 1024 }
};
