import JSZip, { type JSZipObject } from "jszip";

import { splitSafeArchivePath } from "@/lib/archive-path";
import { parseGitHubRepositoryUrl } from "@/lib/github";
import { slugifyTitle } from "@/lib/markdown";
import type {
  BackupBookV1,
  BackupBookmarkV1,
  BackupGitHubSourceV1,
  BackupPageV1,
  ParsedWorkspaceBackup,
  WorkspaceBackupInput,
  WorkspaceBackupManifestV1
} from "@/types/backup";
import { WorkspaceBackupError } from "@/types/backup";
import type { Document, Folder } from "@/types/content";

export const WORKSPACE_BACKUP_LIMITS = {
  zipBytes: 100 * 1024 * 1024,
  pages: 10_000,
  pageBytes: 20 * 1024 * 1024,
  markdownBytes: 250 * 1024 * 1024
} as const;

const HEX_SHA256 = /^[a-f0-9]{64}$/;
const MARKDOWN_PATH = /\.md$/i;

export function validateBackupByteLimits(lengths: readonly number[]) {
  if (lengths.length > WORKSPACE_BACKUP_LIMITS.pages) {
    throw new WorkspaceBackupError("limit_exceeded", "A backup can contain at most 10,000 pages.");
  }
  if (lengths.some((length) => !Number.isSafeInteger(length) || length < 0 || length > WORKSPACE_BACKUP_LIMITS.pageBytes)) {
    throw new WorkspaceBackupError("limit_exceeded", "Each page must be 20 MiB or smaller.");
  }
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total > WORKSPACE_BACKUP_LIMITS.markdownBytes) {
    throw new WorkspaceBackupError("limit_exceeded", "A backup can contain at most 250 MiB of Markdown.");
  }
}

async function sha256(bytes: Uint8Array) {
  const digestInput = new Uint8Array(bytes.byteLength);
  digestInput.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", digestInput);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fold(value: string) {
  return value.toLocaleLowerCase("en-US");
}

function byBookOrder(left: Folder, right: Folder) {
  return left.order - right.order || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function byPageOrder(left: Document, right: Document) {
  return left.order - right.order || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function validTimestamp(value: string) {
  return value.length > 0 && Number.isFinite(Date.parse(value));
}

function validTimestampPair(createdAt: string, updatedAt: string) {
  return validTimestamp(createdAt) && validTimestamp(updatedAt) && Date.parse(createdAt) <= Date.parse(updatedAt);
}

function structure(message: string): never {
  throw new WorkspaceBackupError("unsafe_structure", message);
}

function damaged(message: string): never {
  throw new WorkspaceBackupError("damaged_content", message);
}

function reserveSegment(base: string, used: Set<string>) {
  let segment = base;
  let suffix = 2;
  while (used.has(fold(segment))) {
    segment = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(fold(segment));
  return segment;
}

function validateUniqueOrders<T>(records: readonly T[], key: (record: T) => string, order: (record: T) => number) {
  const seen = new Set<string>();
  for (const record of records) {
    const value = order(record);
    if (!Number.isSafeInteger(value) || value < 0) {
      structure("Backup order values must be non-negative integers.");
    }
    const signature = `${key(record)}\u0000${value}`;
    if (seen.has(signature)) {
      structure("Backup sibling order values must be unique.");
    }
    seen.add(signature);
  }
}

function validateBuilderInput(input: WorkspaceBackupInput) {
  if (!validTimestamp(input.exportedAt)) {
    structure("The backup export timestamp is invalid.");
  }
  const bookIds = new Set<string>();
  for (const book of input.books) {
    if (!book.id || bookIds.has(book.id) || book.parentId !== null || !validTimestampPair(book.createdAt, book.updatedAt)) {
      structure("The library contains invalid book metadata.");
    }
    bookIds.add(book.id);
  }
  validateUniqueOrders(input.books, () => "books", (book) => book.order);

  const pageIds = new Set<string>();
  for (const page of input.pages) {
    if (!page.id || pageIds.has(page.id) || (page.folderId !== null && !bookIds.has(page.folderId)) || !validTimestampPair(page.createdAt, page.updatedAt)) {
      structure("The library contains invalid page metadata.");
    }
    pageIds.add(page.id);
  }
  validateUniqueOrders(input.pages, (page) => page.folderId ?? "unsorted", (page) => page.order);

  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  for (const source of input.githubSources) {
    let repository;
    try {
      repository = parseGitHubRepositoryUrl(source.normalizedUrl);
    } catch {
      structure("The library contains invalid GitHub source metadata.");
    }
    if (
      !source.id || sourceIds.has(source.id) || sourceUrls.has(fold(source.normalizedUrl)) ||
      repository.owner !== source.owner || repository.repository !== source.repository ||
      !bookIds.has(source.rootFolderId) || !validTimestampPair(source.createdAt, source.updatedAt) ||
      !validTimestamp(source.lastRefreshedAt)
    ) {
      structure("The library contains invalid GitHub source metadata.");
    }
    sourceIds.add(source.id);
    sourceUrls.add(fold(source.normalizedUrl));
  }
  for (const book of input.books) {
    if (book.sourceId && (!sourceIds.has(book.sourceId) || input.githubSources.find((source) => source.id === book.sourceId)?.rootFolderId !== book.id)) {
      structure("A book has an invalid GitHub source reference.");
    }
  }
  for (const page of input.pages) {
    const bookSourceId = page.folderId ? input.books.find((book) => book.id === page.folderId)?.sourceId : undefined;
    if (page.sourceId && (!sourceIds.has(page.sourceId) || page.sourceId !== bookSourceId)) {
      structure("A page has an invalid GitHub source reference.");
    }
  }

  const bookmarkPages = new Set<string>();
  for (const bookmark of input.bookmarks) {
    if (bookmark.workspaceId !== "local" || !pageIds.has(bookmark.documentId) || bookmarkPages.has(bookmark.documentId) || !validTimestamp(bookmark.createdAt)) {
      structure("The library contains invalid bookmark metadata.");
    }
    bookmarkPages.add(bookmark.documentId);
  }
}

export async function createWorkspaceBackupBlob(input: WorkspaceBackupInput): Promise<Blob> {
  validateBuilderInput(input);
  const orderedBooks = [...input.books].sort(byBookOrder);
  const orderedPages = [
    ...orderedBooks.flatMap((book) => input.pages.filter((page) => page.folderId === book.id).sort(byPageOrder)),
    ...input.pages.filter((page) => page.folderId === null).sort(byPageOrder)
  ];
  const encodedPages = orderedPages.map((page) => ({ page, bytes: new TextEncoder().encode(page.body) }));
  validateBackupByteLimits(encodedPages.map(({ bytes }) => bytes.byteLength));

  const zip = new JSZip();
  const usedBookSegments = new Set<string>();
  const bookSegments = new Map<string, string>();
  for (const book of orderedBooks) {
    bookSegments.set(book.id, reserveSegment(slugifyTitle(book.name), usedBookSegments));
  }

  const usedPaths = new Set<string>();
  const pages: BackupPageV1[] = [];
  for (const { page, bytes } of encodedPages) {
    const parent = page.folderId === null ? "unsorted" : `books/${bookSegments.get(page.folderId)}`;
    const base = slugifyTitle(page.title);
    let suffix = 1;
    let path: string;
    do {
      const name = suffix === 1 ? `${base}.md` : `${base}-${suffix}.md`;
      path = `${parent}/${name}`;
      suffix += 1;
    } while (usedPaths.has(fold(path)));
    usedPaths.add(fold(path));
    // JSZip 3 uses realm-sensitive `instanceof Uint8Array` checks. Converting to a
    // plain array keeps the exact bytes and also works when TextEncoder belongs to
    // a browser/jsdom realm that differs from the bundled JSZip realm.
    zip.file(path, Array.from(bytes));
    pages.push({
      id: page.id,
      title: page.title,
      bookId: page.folderId,
      order: page.order,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      ...(page.sourceId ? { sourceId: page.sourceId } : {}),
      path,
      byteLength: bytes.byteLength,
      sha256: await sha256(bytes)
    });
  }

  const books: BackupBookV1[] = orderedBooks.map((book) => ({
    id: book.id,
    name: book.name,
    order: book.order,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    ...(book.sourceId ? { sourceId: book.sourceId } : {})
  }));
  const bookmarks: BackupBookmarkV1[] = input.bookmarks
    .map((bookmark) => ({ pageId: bookmark.documentId, createdAt: bookmark.createdAt }))
    .sort((left, right) => left.pageId.localeCompare(right.pageId));
  const githubSources: BackupGitHubSourceV1[] = input.githubSources
    .map(({ rootFolderId, ...sourceMetadata }) => ({ ...sourceMetadata, rootBookId: rootFolderId }))
    .sort((left, right) => left.normalizedUrl.localeCompare(right.normalizedUrl) || left.id.localeCompare(right.id));
  const manifest: WorkspaceBackupManifestV1 = {
    format: "mdez-library-backup",
    schemaVersion: 1,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt,
    books,
    pages,
    bookmarks,
    githubSources
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/zip"
  });
  if (blob.size > WORKSPACE_BACKUP_LIMITS.zipBytes) {
    throw new WorkspaceBackupError("limit_exceeded", "The backup ZIP is larger than 100 MiB.");
  }
  return blob;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string, allowEmpty = false) {
  const value = record[key];
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    structure(`The manifest has an invalid ${key} field.`);
  }
  return value;
}

function optionalStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) structure(`The manifest has an invalid ${key} field.`);
  return value;
}

function integerField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || Number(value) < 0) structure(`The manifest has an invalid ${key} field.`);
  return Number(value);
}

function timestampField(record: Record<string, unknown>, key: string) {
  const value = stringField(record, key);
  if (!validTimestamp(value)) structure(`The manifest has an invalid ${key} timestamp.`);
  return value;
}

function metadataTimes(record: Record<string, unknown>) {
  const createdAt = timestampField(record, "createdAt");
  const updatedAt = timestampField(record, "updatedAt");
  if (Date.parse(createdAt) > Date.parse(updatedAt)) structure("A creation timestamp is after its update timestamp.");
  return { createdAt, updatedAt };
}

function recordArray(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) structure(`The manifest has an invalid ${key} array.`);
  return value as Record<string, unknown>[];
}

function uniqueId(id: string, seen: Set<string>, label: string) {
  if (seen.has(id)) structure(`The manifest contains a duplicate ${label} ID.`);
  seen.add(id);
  return id;
}

function parseManifest(value: unknown): WorkspaceBackupManifestV1 {
  if (!isRecord(value)) structure("The manifest must be a JSON object.");
  if (value.format !== "mdez-library-backup") {
    throw new WorkspaceBackupError("unsupported_version", "This file is not an Mdez library backup.");
  }
  if (value.schemaVersion !== 1) {
    throw new WorkspaceBackupError("unsupported_version", "This backup version is not supported. Update Mdez and try again.");
  }
  const appVersion = stringField(value, "appVersion", true);
  const exportedAt = timestampField(value, "exportedAt");
  const bookIds = new Set<string>();
  const books: BackupBookV1[] = recordArray(value, "books").map((record) => {
    const id = uniqueId(stringField(record, "id"), bookIds, "book");
    const times = metadataTimes(record);
    return { id, name: stringField(record, "name"), order: integerField(record, "order"), ...times, ...(optionalStringField(record, "sourceId") ? { sourceId: optionalStringField(record, "sourceId") } : {}) };
  });
  validateUniqueOrders(books, () => "books", (book) => book.order);

  const pageIds = new Set<string>();
  const paths = new Set<string>();
  const pages: BackupPageV1[] = recordArray(value, "pages").map((record) => {
    const id = uniqueId(stringField(record, "id"), pageIds, "page");
    const rawBookId = record.bookId;
    if (rawBookId !== null && (typeof rawBookId !== "string" || !bookIds.has(rawBookId))) structure("A page references a missing book.");
    const path = stringField(record, "path");
    splitSafeArchivePath(path);
    if (!MARKDOWN_PATH.test(path) || fold(path) === "manifest.json" || paths.has(fold(path))) structure("The manifest contains an invalid or duplicate page path.");
    paths.add(fold(path));
    const digest = stringField(record, "sha256");
    if (!HEX_SHA256.test(digest)) structure("The manifest contains an invalid SHA-256 value.");
    const times = metadataTimes(record);
    const sourceId = optionalStringField(record, "sourceId");
    return {
      id,
      title: stringField(record, "title"),
      bookId: rawBookId,
      order: integerField(record, "order"),
      ...times,
      ...(sourceId ? { sourceId } : {}),
      path,
      byteLength: integerField(record, "byteLength"),
      sha256: digest
    };
  });
  validateUniqueOrders(pages, (page) => page.bookId ?? "unsorted", (page) => page.order);
  validateBackupByteLimits(pages.map((page) => page.byteLength));

  const sourceIds = new Set<string>();
  const sourceUrls = new Set<string>();
  const githubSources: BackupGitHubSourceV1[] = recordArray(value, "githubSources").map((record) => {
    const id = uniqueId(stringField(record, "id"), sourceIds, "GitHub source");
    const normalizedUrl = stringField(record, "normalizedUrl");
    let repository;
    try {
      repository = parseGitHubRepositoryUrl(normalizedUrl);
    } catch {
      structure("A GitHub source URL is invalid.");
    }
    const owner = stringField(record, "owner");
    const repositoryName = stringField(record, "repository");
    const rootBookId = stringField(record, "rootBookId");
    if (repository.owner !== owner || repository.repository !== repositoryName || !bookIds.has(rootBookId) || sourceUrls.has(fold(normalizedUrl))) {
      structure("A GitHub source relationship is invalid.");
    }
    sourceUrls.add(fold(normalizedUrl));
    const times = metadataTimes(record);
    return { id, owner, repository: repositoryName, normalizedUrl, branch: stringField(record, "branch"), rootBookId, lastRefreshedAt: timestampField(record, "lastRefreshedAt"), ...times };
  });
  for (const source of githubSources) {
    const root = books.find((book) => book.id === source.rootBookId);
    if (root?.sourceId !== source.id) structure("A GitHub source is not linked to its root book.");
  }
  for (const book of books) {
    if (book.sourceId && !sourceIds.has(book.sourceId)) structure("A book references a missing GitHub source.");
  }
  for (const page of pages) {
    const bookSource = page.bookId ? books.find((book) => book.id === page.bookId)?.sourceId : undefined;
    if (page.sourceId && (!sourceIds.has(page.sourceId) || page.sourceId !== bookSource)) structure("A page references an invalid GitHub source.");
  }

  const bookmarkPages = new Set<string>();
  const bookmarks: BackupBookmarkV1[] = recordArray(value, "bookmarks").map((record) => {
    const pageId = stringField(record, "pageId");
    if (!pageIds.has(pageId) || bookmarkPages.has(pageId)) structure("A bookmark references a missing or duplicate page.");
    bookmarkPages.add(pageId);
    return { pageId, createdAt: timestampField(record, "createdAt") };
  });
  return { format: "mdez-library-backup", schemaVersion: 1, appVersion, exportedAt, books, pages, bookmarks, githubSources };
}

function originalEntryName(entry: JSZipObject) {
  return entry.unsafeOriginalName ?? entry.name;
}

export async function parseWorkspaceBackup(blob: Blob): Promise<ParsedWorkspaceBackup> {
  if (blob.size > WORKSPACE_BACKUP_LIMITS.zipBytes) {
    throw new WorkspaceBackupError("limit_exceeded", "The backup ZIP is larger than 100 MiB.");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(blob, { checkCRC32: true });
  } catch {
    throw new WorkspaceBackupError("invalid_zip", "Mdez could not read this ZIP file.");
  }
  const entries = Object.values(zip.files);
  const archivePaths = new Set<string>();
  for (const entry of entries) {
    const original = originalEntryName(entry);
    const path = entry.dir && original.endsWith("/") ? original.slice(0, -1) : original;
    try {
      splitSafeArchivePath(path);
    } catch {
      structure("The backup contains an unsafe archive path.");
    }
    const folded = fold(path);
    if (archivePaths.has(folded)) structure("The backup contains duplicate archive paths.");
    archivePaths.add(folded);
  }
  const manifestEntries = entries.filter((entry) => !entry.dir && fold(originalEntryName(entry)) === "manifest.json");
  if (manifestEntries.length !== 1) {
    throw new WorkspaceBackupError("invalid_zip", "The backup is missing one readable manifest.json file.");
  }
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(await manifestEntries[0].async("string"));
  } catch {
    throw new WorkspaceBackupError("invalid_zip", "The backup manifest is unreadable.");
  }
  const manifest = parseManifest(rawManifest);
  const declaredPaths = new Set(manifest.pages.map((page) => fold(page.path)));
  const impliedDirectories = new Set<string>();
  for (const page of manifest.pages) {
    const segments = splitSafeArchivePath(page.path);
    for (let index = 1; index < segments.length; index += 1) impliedDirectories.add(fold(segments.slice(0, index).join("/")));
  }
  for (const entry of entries) {
    const original = originalEntryName(entry);
    const path = entry.dir && original.endsWith("/") ? original.slice(0, -1) : original;
    const folded = fold(path);
    if (entry.dir ? !impliedDirectories.has(folded) : folded !== "manifest.json" && !declaredPaths.has(folded)) {
      structure("The backup contains undeclared archive entries.");
    }
  }
  const parsedPages = [];
  const lengths: number[] = [];
  for (const metadata of manifest.pages) {
    const entry = entries.find((candidate) => !candidate.dir && fold(originalEntryName(candidate)) === fold(metadata.path));
    if (!entry) damaged(`${metadata.path} is missing from the backup.`);
    const bytes = await entry.async("uint8array");
    lengths.push(bytes.byteLength);
    validateBackupByteLimits(lengths);
    if (bytes.byteLength !== metadata.byteLength || await sha256(bytes) !== metadata.sha256) {
      damaged(`${metadata.path} does not match its manifest integrity data.`);
    }
    let body: string;
    try {
      body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      damaged(`${metadata.path} is not valid UTF-8.`);
    }
    parsedPages.push({ metadata, body });
  }
  return { manifest, pages: parsedPages, totalMarkdownBytes: lengths.reduce((sum, length) => sum + length, 0) };
}
