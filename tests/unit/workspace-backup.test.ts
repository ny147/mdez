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
  it("round-trips flattened books sharing one GitHub source", async () => {
    const childBook = { ...githubBook, id: "flattened-book", name: "Codex / docs", order: 3 };
    const childPage = { ...githubPage, id: "nested-page", folderId: childBook.id };
    const parsed = await parseWorkspaceBackup(await createWorkspaceBackupBlob({
      ...input, books: [...input.books, childBook], pages: [...input.pages, childPage]
    }));
    expect(parsed.manifest.books.filter((book) => book.sourceId === source.id)).toHaveLength(2);
    expect(parsed.pages.find((page) => page.metadata.id === childPage.id)?.metadata.sourceId).toBe(source.id);
  });

  it("rejects a source whose root book does not link back", async () => {
    await expect(createWorkspaceBackupBlob({ ...input, books: input.books.map((book) => ({ ...book, sourceId: undefined })) }))
      .rejects.toMatchObject({ code: "unsafe_structure" });
  });

  it.each(["September 22, 2026", "2026-02-30T00:00:00.000Z", "2026-09-22"])("rejects non-ISO or normalized-invalid timestamp %s", async (exportedAt) => {
    const zip = await generatedZip();
    const manifest = await readManifest(zip);
    await expect(writeManifest(zip, { ...manifest, exportedAt }).then(parseWorkspaceBackup)).rejects.toMatchObject({ code: "unsafe_structure" });
    await expect(createWorkspaceBackupBlob({ ...input, exportedAt })).rejects.toMatchObject({ code: "unsafe_structure" });
  });

  it.each(["2026-09-22T07:00:00+07:00", "2026-09-22T00:00:00Z"])("accepts valid ISO timestamps %s", async (exportedAt) => {
    const parsed = await parseWorkspaceBackup(await createWorkspaceBackupBlob({ ...input, exportedAt }));
    expect(parsed.manifest.exportedAt).toBe(exportedAt);
  });

  it.each(["", "PK", "not a zip"])("reports truncated or non-ZIP input %j", async (contents) => {
    await expect(parseWorkspaceBackup(new Blob([contents]))).rejects.toMatchObject({ code: "invalid_zip" });
  });

  it.each(["manifest.json", "books/notes/plan.md"])("rejects exact duplicate raw ZIP records for %s", async (name) => {
    const bytes = await (await generatedZip()).generateAsync({ type: "uint8array" });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = bytes.length - 22;
    const centralStart = view.getUint32(end + 16, true);
    let offset = centralStart;
    let record = new Uint8Array();
    while (offset < end) {
      const nameLength = view.getUint16(offset + 28, true);
      const length = 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
      if (new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength)) === name) record = bytes.slice(offset, offset + length);
      offset += length;
    }
    expect(record.length).toBeGreaterThan(0);
    const duplicate = new Uint8Array(bytes.length + record.length);
    duplicate.set(bytes.slice(0, end));
    duplicate.set(record, end);
    duplicate.set(bytes.slice(end), end + record.length);
    const duplicateView = new DataView(duplicate.buffer);
    for (const countOffset of [8, 10]) duplicateView.setUint16(end + record.length + countOffset, view.getUint16(end + countOffset, true) + 1, true);
    duplicateView.setUint32(end + record.length + 12, view.getUint32(end + 12, true) + record.length, true);
    await expect(parseWorkspaceBackup(new Blob([duplicate]))).rejects.toMatchObject({ code: "unsafe_structure" });
  });

  it("rejects undeclared compressed data before trying to decompress it", async () => {
    const zip = await generatedZip();
    zip.file("undeclared.md", "do not inflate");
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = view.getUint32(bytes.length - 6, true);
    while (view.getUint32(offset, true) === 0x02014b50) {
      const nameLength = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      if (name === "undeclared.md") {
        const local = view.getUint32(offset + 42, true);
        const data = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        bytes[data] = 0xff; // Invalid DEFLATE; eager CRC loading would report invalid_zip.
      }
      offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    }
    await expect(parseWorkspaceBackup(new Blob([new Uint8Array(bytes)]))).rejects.toMatchObject({ code: "unsafe_structure" });
  });

  it("rejects an inflated size above the page limit before materializing the entry", async () => {
    const zip = await generatedZip();
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = view.getUint32(bytes.length - 6, true);
    while (view.getUint32(offset, true) === 0x02014b50) {
      const nameLength = view.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      if (name === "books/notes/plan.md") view.setUint32(offset + 24, WORKSPACE_BACKUP_LIMITS.pageBytes + 1, true);
      offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    }
    await expect(parseWorkspaceBackup(new Blob([new Uint8Array(bytes)]))).rejects.toMatchObject({ code: "limit_exceeded" });
  });

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
