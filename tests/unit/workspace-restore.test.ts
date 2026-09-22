import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { listContent, restoreWorkspaceBackup } from "@/lib/repository";
import { createWorkspaceRestorePlan } from "@/lib/workspace-restore-plan";
import type { ParsedWorkspaceBackup, WorkspaceBackupManifestV1 } from "@/types/backup";
import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";

const timestamp = "2026-09-22T00:00:00.000Z";
const existingBook: Folder = { id: "existing-book", name: "Notes", parentId: null, sourceId: "existing-source", order: 0, createdAt: timestamp, updatedAt: timestamp };
const existingPage: Document = { id: "existing-page", title: "Existing", body: "keep", folderId: null, order: 0, createdAt: timestamp, updatedAt: timestamp };
const existingSource: GitHubSource = {
  id: "existing-source",
  owner: "openai",
  repository: "codex",
  normalizedUrl: "https://github.com/openai/codex",
  branch: "main",
  rootFolderId: existingBook.id,
  lastRefreshedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
};

function parsedBackup(): ParsedWorkspaceBackup {
  const books = [
    { id: "archive-book-1", name: "Notes", sourceId: "archive-source-1", order: 0, createdAt: timestamp, updatedAt: timestamp },
    { id: "archive-book-2", name: "notes", order: 1, createdAt: timestamp, updatedAt: timestamp },
    { id: "archive-book-3", name: "Research", sourceId: "archive-source-2", order: 2, createdAt: timestamp, updatedAt: timestamp }
  ];
  const pageMetadata = [
    { id: "archive-page-1", title: "Plan", bookId: books[0].id, sourceId: "archive-source-1", order: 0, createdAt: timestamp, updatedAt: timestamp, path: "books/notes/plan.md", byteLength: 4, sha256: "a".repeat(64) },
    { id: "archive-page-2", title: "Guide", bookId: books[0].id, sourceId: "archive-source-1", order: 1, createdAt: timestamp, updatedAt: timestamp, path: "books/notes/guide.md", byteLength: 5, sha256: "b".repeat(64) },
    { id: "archive-page-3", title: "Loose", bookId: null, order: 0, createdAt: timestamp, updatedAt: timestamp, path: "unsorted/loose.md", byteLength: 5, sha256: "c".repeat(64) },
    { id: "archive-page-4", title: "Study", bookId: books[2].id, sourceId: "archive-source-2", order: 0, createdAt: timestamp, updatedAt: timestamp, path: "books/research/study.md", byteLength: 5, sha256: "d".repeat(64) }
  ];
  const manifest: WorkspaceBackupManifestV1 = {
    format: "mdez-library-backup",
    schemaVersion: 1,
    appVersion: "0.1.0",
    exportedAt: timestamp,
    books,
    pages: pageMetadata,
    bookmarks: [{ pageId: pageMetadata[0].id, createdAt: timestamp }],
    githubSources: [
      { id: "archive-source-1", owner: "openai", repository: "codex", normalizedUrl: "https://github.com/openai/codex", branch: "main", rootBookId: books[0].id, lastRefreshedAt: timestamp, createdAt: timestamp, updatedAt: timestamp },
      { id: "archive-source-2", owner: "example", repository: "research", normalizedUrl: "https://github.com/example/research", branch: "main", rootBookId: books[2].id, lastRefreshedAt: timestamp, createdAt: timestamp, updatedAt: timestamp }
    ]
  };
  return {
    manifest,
    pages: pageMetadata.map((metadata) => ({ metadata, body: metadata.title })),
    totalMarkdownBytes: 19
  };
}

async function seedExisting() {
  await db.transaction("rw", db.folders, db.documents, db.githubSources, db.pageBookmarks, async () => {
    await db.folders.add(existingBook);
    await db.documents.add(existingPage);
    await db.githubSources.add(existingSource);
    await db.pageBookmarks.add({ workspaceId: "local", documentId: existingPage.id, createdAt: timestamp });
  });
}

async function snapshot() {
  return {
    folders: await db.folders.toArray(),
    documents: await db.documents.toArray(),
    sources: await db.githubSources.toArray(),
    bookmarks: await db.pageBookmarks.toArray()
  };
}

describe("workspace restore", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    db.close();
    await Dexie.delete(db.name);
  });

  it("plans deterministic collision, source, and summary outcomes", () => {
    const parsed = parsedBackup();
    const plan = createWorkspaceRestorePlan(parsed, { folders: [existingBook], sources: [existingSource] });

    expect(plan.books.map(({ restoredName, renamed }) => ({ restoredName, renamed }))).toEqual([
      { restoredName: "Notes (restored)", renamed: true },
      { restoredName: "notes (restored 2)", renamed: true },
      { restoredName: "Research", renamed: false }
    ]);
    expect(plan.sources.map(({ action }) => action)).toEqual(["detach", "retain"]);
    expect(plan.summary).toEqual({ bookCount: 3, emptyBookCount: 1, pageCount: 4, unsortedPageCount: 1, bookmarkCount: 1, totalMarkdownBytes: 19 });
  });

  it("remaps every ID and appends restored records atomically", async () => {
    await seedExisting();
    const parsed = parsedBackup();
    const plan = createWorkspaceRestorePlan(parsed, { folders: [existingBook], sources: [existingSource] });
    const result = await restoreWorkspaceBackup(plan);
    const content = await listContent();
    const existingIds = new Set([existingPage.id]);
    const archivePageIds = new Set(parsed.manifest.pages.map((page) => page.id));
    const restored = content.documents.filter((page) => !existingIds.has(page.id));

    expect(restored).toHaveLength(plan.summary.pageCount);
    expect(restored.every((page) => !archivePageIds.has(page.id))).toBe(true);
    expect(content.folders.find((book) => book.name === "Notes (restored)")).toBeDefined();
    expect(restored.find((page) => page.title === "Loose")?.folderId).toBeNull();
    expect(restored.find((page) => page.title === "Loose")?.order).toBe(1);
    expect(await db.pageBookmarks.get(["local", result.firstDocumentId!])).toBeDefined();
    expect(result).toMatchObject({ bookCount: 3, pageCount: 4, bookmarkCount: 1 });
  });

  it("detaches every record owned by a duplicate source", async () => {
    await seedExisting();
    const parsed = parsedBackup();
    const plan = createWorkspaceRestorePlan(parsed, { folders: [existingBook], sources: [existingSource] });
    await restoreWorkspaceBackup(plan);
    const content = await listContent();
    const detachedTitles = new Set(["Plan", "Guide"]);

    expect(content.sources).toHaveLength(2);
    expect(content.folders.find((book) => book.name === "Notes (restored)")).not.toHaveProperty("sourceId");
    expect(content.documents.filter((page) => detachedTitles.has(page.title)).every((page) => !page.sourceId)).toBe(true);
    expect(content.folders.find((book) => book.name === "Research")?.sourceId).toBeDefined();
  });

  it("rejects a stale preview with zero writes", async () => {
    await seedExisting();
    const plan = createWorkspaceRestorePlan(parsedBackup(), { folders: [existingBook], sources: [existingSource] });
    await db.folders.add({ ...existingBook, id: "second-tab-book", name: "Research", sourceId: undefined, order: 1 });
    const before = await snapshot();

    await expect(restoreWorkspaceBackup(plan)).rejects.toMatchObject({ code: "stale_preview" });
    expect(await snapshot()).toEqual(before);
  });

  it("rolls back every table when a page insert fails", async () => {
    await seedExisting();
    const plan = createWorkspaceRestorePlan(parsedBackup(), { folders: [existingBook], sources: [existingSource] });
    const before = await snapshot();
    const originalAdd = db.documents.add.bind(db.documents);
    let additions = 0;
    vi.spyOn(db.documents, "add").mockImplementation(((document) => {
      additions += 1;
      if (additions === 2) throw new Error("Insert failed.");
      return originalAdd(document);
    }) as typeof db.documents.add);

    await expect(restoreWorkspaceBackup(plan)).rejects.toThrow("Insert failed.");
    expect(await snapshot()).toEqual(before);
  });
});
