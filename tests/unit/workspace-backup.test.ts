import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  createWorkspaceBackupBlob,
  parseWorkspaceBackup,
  validateBackupByteLimits,
  WORKSPACE_BACKUP_LIMITS
} from "@/lib/workspace-backup";
import type { WorkspaceBackupInput, WorkspaceBackupManifestV1 } from "@/types/backup";
import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";

const timestamp = "2026-09-22T00:00:00.000Z";
const book: Folder = { id: "book-1", name: "Notes", parentId: null, order: 0, createdAt: timestamp, updatedAt: timestamp };
const emptyBook: Folder = { id: "book-2", name: "Empty", parentId: null, order: 1, createdAt: timestamp, updatedAt: timestamp };
const githubBook: Folder = { id: "book-3", name: "Codex", parentId: null, sourceId: "source-1", order: 2, createdAt: timestamp, updatedAt: timestamp };
const bookPage: Document = { id: "page-1", title: "Plan", body: "# Plan", folderId: book.id, order: 0, createdAt: timestamp, updatedAt: timestamp };
const duplicateTitlePage: Document = { ...bookPage, id: "page-2", title: "Plan!", body: "second", order: 1 };
const unicodeUnsortedPage: Document = { ...bookPage, id: "page-3", title: "Untitled", body: "สวัสดี 👋", folderId: null, order: 0 };
const githubPage: Document = { ...bookPage, id: "page-4", title: "README", body: "# Codex", sourceId: "source-1", folderId: githubBook.id, order: 0 };
const source: GitHubSource = {
  id: "source-1",
  owner: "openai",
  repository: "codex",
  normalizedUrl: "https://github.com/openai/codex",
  branch: "main",
  rootFolderId: githubBook.id,
  lastRefreshedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
};

const input: WorkspaceBackupInput = {
  appVersion: "0.1.0",
  exportedAt: timestamp,
  books: [book, emptyBook, githubBook],
  pages: [bookPage, duplicateTitlePage, unicodeUnsortedPage, githubPage],
  bookmarks: [{ workspaceId: "local", documentId: bookPage.id, createdAt: timestamp }],
  githubSources: [source]
};

async function generatedZip() {
  return JSZip.loadAsync(await createWorkspaceBackupBlob(input));
}

async function readManifest(zip: JSZip): Promise<WorkspaceBackupManifestV1> {
  return JSON.parse(await zip.file("manifest.json")!.async("string"));
}

async function writeManifest(zip: JSZip, manifest: WorkspaceBackupManifestV1) {
  zip.file("manifest.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "blob" });
}

async function hash(bytes: Uint8Array) {
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function malformedArchive(name: string): Promise<Blob> {
  const zip = await generatedZip();
  const manifest = await readManifest(zip);

  switch (name) {
    case "missing manifest":
      zip.remove("manifest.json");
      return zip.generateAsync({ type: "blob" });
    case "unsupported schema":
      return writeManifest(zip, { ...manifest, schemaVersion: 2 as 1 });
    case "undeclared file":
      zip.file("extra.md", "surprise");
      return zip.generateAsync({ type: "blob" });
    case "missing declared file":
      zip.remove(manifest.pages[0].path);
      return zip.generateAsync({ type: "blob" });
    case "case-insensitive duplicate path":
      zip.file(manifest.pages[0].path.toUpperCase(), "duplicate");
      return zip.generateAsync({ type: "blob" });
    case "duplicate book ID":
      manifest.books.push({ ...manifest.books[0] });
      return writeManifest(zip, manifest);
    case "dangling book reference":
      manifest.pages[0].bookId = "missing";
      return writeManifest(zip, manifest);
    case "invalid timestamp":
      manifest.books[0].createdAt = "yesterday";
      return writeManifest(zip, manifest);
    case "checksum mismatch":
      zip.file(manifest.pages[0].path, "changed");
      return zip.generateAsync({ type: "blob" });
    case "invalid UTF-8": {
      const bytes = new Uint8Array([0xc3, 0x28]);
      zip.file(manifest.pages[0].path, Array.from(bytes));
      manifest.pages[0].byteLength = bytes.byteLength;
      manifest.pages[0].sha256 = await hash(bytes);
      return writeManifest(zip, manifest);
    }
    default:
      throw new Error(`Unknown malformed archive: ${name}`);
  }
}

describe("workspace backup", () => {
  it("creates a schema-v1 ZIP and round-trips every included record", async () => {
    const blob = await createWorkspaceBackupBlob(input);
    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      "manifest.json",
      "books/notes/plan.md",
      "books/notes/plan-2.md",
      "unsorted/untitled.md"
    ]));

    const parsed = await parseWorkspaceBackup(blob);
    expect(parsed.manifest).toMatchObject({ format: "mdez-library-backup", schemaVersion: 1, appVersion: "0.1.0" });
    expect(parsed.manifest.books).toContainEqual(expect.objectContaining({ id: emptyBook.id }));
    expect(parsed.pages.find((page) => page.metadata.id === unicodeUnsortedPage.id)?.body).toBe(unicodeUnsortedPage.body);
    expect(new TextEncoder().encode(unicodeUnsortedPage.body).byteLength).toBeGreaterThan(unicodeUnsortedPage.body.length);
    expect(parsed.manifest.bookmarks).toEqual([{ pageId: bookPage.id, createdAt: timestamp }]);
    expect(parsed.manifest.githubSources[0]).toMatchObject({ id: source.id, rootBookId: githubBook.id });
  });

  it.each([
    ["missing manifest", "invalid_zip"],
    ["unsupported schema", "unsupported_version"],
    ["undeclared file", "unsafe_structure"],
    ["missing declared file", "damaged_content"],
    ["case-insensitive duplicate path", "unsafe_structure"],
    ["duplicate book ID", "unsafe_structure"],
    ["dangling book reference", "unsafe_structure"],
    ["invalid timestamp", "unsafe_structure"],
    ["checksum mismatch", "damaged_content"],
    ["invalid UTF-8", "damaged_content"]
  ])("rejects %s with %s and no mutation", async (name, code) => {
    await expect(malformedArchive(name).then(parseWorkspaceBackup)).rejects.toMatchObject({ code });
  });

  it("enforces exact numeric content boundaries", () => {
    expect(() => validateBackupByteLimits([20 * 1024 * 1024])).not.toThrow();
    expect(() => validateBackupByteLimits([20 * 1024 * 1024 + 1])).toThrow(/20 MiB/);
    expect(() => validateBackupByteLimits(Array.from({ length: 10_000 }, () => 1))).not.toThrow();
    expect(() => validateBackupByteLimits(Array.from({ length: 10_001 }, () => 1))).toThrow(/10,000/);
    expect(() => validateBackupByteLimits([250 * 1024 * 1024])).toThrow(/20 MiB/);
    expect(() => validateBackupByteLimits(Array.from({ length: 13 }, () => 20 * 1024 * 1024))).toThrow(/250 MiB/);
  });

  it("applies count and per-page limits while building", async () => {
    const tooManyPages = Array.from({ length: WORKSPACE_BACKUP_LIMITS.pages + 1 }, (_, index) => ({
      ...bookPage,
      id: `limit-page-${index}`,
      order: index,
      body: "x"
    }));
    await expect(createWorkspaceBackupBlob({ ...input, pages: tooManyPages, bookmarks: [] })).rejects.toMatchObject({ code: "limit_exceeded" });
    await expect(createWorkspaceBackupBlob({ ...input, pages: [{ ...bookPage, body: "x".repeat(WORKSPACE_BACKUP_LIMITS.pageBytes + 1) }], bookmarks: [] }))
      .rejects.toMatchObject({ code: "limit_exceeded" });
  });

  it("rejects an oversized ZIP before attempting to load it", async () => {
    const oversized = { size: WORKSPACE_BACKUP_LIMITS.zipBytes + 1 } as Blob;
    await expect(parseWorkspaceBackup(oversized)).rejects.toMatchObject({ code: "limit_exceeded" });
  });
});
