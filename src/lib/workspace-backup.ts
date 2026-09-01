import JSZip from "jszip";

import { buildWorkspaceExportEntries } from "@/lib/export";
import type { Document, Folder } from "@/types/content";
import type { GitHubSource } from "@/types/github";
import type { ParsedWorkspaceBackup, WorkspaceBackupManifestV1, WorkspaceBackupPreview } from "@/types/backup";

const MAX_COMPRESSED_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 10_000;

function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

type BackupInput = {
  appVersion: string;
  workspace: WorkspaceBackupManifestV1["workspace"];
  folders: Folder[];
  documents: Document[];
  githubSources: GitHubSource[];
};

function withoutBody(document: Document, path: string): WorkspaceBackupManifestV1["documents"][number] {
  const { body: _body, ...metadata } = document;
  void _body;
  return { ...metadata, path };
}

export async function createWorkspaceBackupBlob(input: BackupInput) {
  const zip = new JSZip();
  const entries = buildWorkspaceExportEntries(input.folders, input.documents);
  const paths = new Map(entries.map((entry) => [entry.documentId, entry.path]));
  const manifest: WorkspaceBackupManifestV1 = {
    app: "Mdez",
    schemaVersion: 1,
    appVersion: input.appVersion,
    exportedAt: new Date().toISOString(),
    workspace: { ...input.workspace },
    folders: input.folders.map((folder) => ({ ...folder })),
    documents: input.documents.map((document) => withoutBody(document, paths.get(document.id)!)),
    githubSources: input.githubSources.map((source) => ({ ...source }))
  };
  for (const entry of entries) zip.file(entry.path, entry.body);
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: "blob" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string { return typeof value === "string"; }
function isNullableString(value: unknown): value is string | null { return value === null || isString(value); }
function hasBaseRecord(value: unknown): value is Record<string, unknown> & { id: string; createdAt: string; updatedAt: string } {
  return isRecord(value) && isString(value.id) && isString(value.createdAt) && isString(value.updatedAt);
}

function isFolder(value: unknown): value is Folder {
  return hasBaseRecord(value) && isString(value.name) && isNullableString(value.parentId) && typeof value.order === "number" && (value.sourceId === undefined || isString(value.sourceId));
}

function isManifestDocument(value: unknown): value is WorkspaceBackupManifestV1["documents"][number] {
  return hasBaseRecord(value) && isString(value.title) && isNullableString(value.folderId) && typeof value.order === "number" && isString(value.path) && (value.sourceId === undefined || isString(value.sourceId));
}

function isGitHubSource(value: unknown): value is GitHubSource {
  return hasBaseRecord(value) && [value.owner, value.repository, value.normalizedUrl, value.branch, value.rootFolderId, value.lastRefreshedAt].every(isString);
}

function parseManifest(value: unknown): WorkspaceBackupManifestV1 {
  if (!isRecord(value)) throw new Error("The backup manifest is invalid.");
  if (value.schemaVersion !== 1) throw new Error("This backup version is not supported.");
  const workspace = value.workspace;
  if (value.app !== "Mdez" || !isString(value.appVersion) || !isString(value.exportedAt) || !isRecord(workspace)
    || (workspace.kind !== "local" && workspace.kind !== "group") || !isNullableString(workspace.id) || !isString(workspace.name)
    || !Array.isArray(value.folders) || !value.folders.every(isFolder)
    || !Array.isArray(value.documents) || !value.documents.every(isManifestDocument)
    || !Array.isArray(value.githubSources) || !value.githubSources.every(isGitHubSource)) {
    throw new Error("The backup manifest is invalid.");
  }
  return value as WorkspaceBackupManifestV1;
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`The backup contains duplicate ${label} IDs.`);
}

function assertSafePath(path: string) {
  if (!path || path.includes("\\") || path.includes("\0") || path.startsWith("/") || /^[a-zA-Z]:/.test(path) || path.split("/").includes("..")) {
    throw new Error("The backup contains an unsafe file path.");
  }
}

function validateRelationships(manifest: WorkspaceBackupManifestV1) {
  assertUnique(manifest.folders.map((folder) => folder.id), "book");
  assertUnique(manifest.documents.map((document) => document.id), "page");
  assertUnique(manifest.githubSources.map((source) => source.id), "GitHub source");
  const folders = new Map(manifest.folders.map((folder) => [folder.id, folder]));
  for (const folder of manifest.folders) {
    if (folder.parentId !== null && !folders.has(folder.parentId)) throw new Error("The backup references a missing parent book.");
    const visited = new Set<string>([folder.id]);
    let parentId = folder.parentId;
    while (parentId !== null) {
      if (visited.has(parentId)) throw new Error("The backup contains a book cycle.");
      visited.add(parentId);
      parentId = folders.get(parentId)?.parentId ?? null;
    }
  }
  for (const document of manifest.documents) {
    if (document.folderId !== null && !folders.has(document.folderId)) throw new Error("The backup references a missing book.");
    assertSafePath(document.path);
  }
}

export async function previewWorkspaceBackup(file: File): Promise<WorkspaceBackupPreview> {
  if (!file.name.toLowerCase().endsWith(".mdez.zip")) throw new Error("Choose an Mdez workspace backup ending in .mdez.zip.");
  if (file.size > MAX_COMPRESSED_BYTES) throw new Error("The backup is larger than 100 MB.");
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(await readBlob(file)); }
  catch { throw new Error("Mdez could not read this backup archive."); }
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ENTRIES) throw new Error("The backup contains more than 10,000 files.");
  const manifestEntry = zip.file("manifest.json");
  if (!manifestEntry) throw new Error("The backup is missing manifest.json.");
  let rawManifest: unknown;
  try { rawManifest = JSON.parse(await manifestEntry.async("string")); }
  catch { throw new Error("The backup manifest is invalid."); }
  const manifest = parseManifest(rawManifest);
  validateRelationships(manifest);
  const declaredPaths = new Set(manifest.documents.map((document) => document.path));
  for (const entry of entries) {
    const originalName = (entry as JSZip.JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    assertSafePath(originalName);
    if (!entry.dir && entry.name.toLowerCase().endsWith(".md") && !declaredPaths.has(entry.name)) throw new Error("The backup contains an undeclared Markdown file.");
  }
  for (const path of declaredPaths) if (!zip.file(path)) throw new Error("The backup is missing a declared Markdown file.");
  const parsedDocuments: ParsedWorkspaceBackup["documents"] = [];
  for (const document of manifest.documents) {
    parsedDocuments.push({ ...document, body: await zip.file(document.path)!.async("string") });
  }
  const warnings = manifest.workspace.kind === "group" ? ["This shared workspace backup will restore into Local Library."] : [];
  return {
    workspaceName: manifest.workspace.name,
    workspaceKind: manifest.workspace.kind,
    exportedAt: manifest.exportedAt,
    folderCount: manifest.folders.length,
    documentCount: manifest.documents.length,
    warnings,
    parsed: { manifest, documents: parsedDocuments }
  };
}
