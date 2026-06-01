import JSZip from "jszip";
import type { Document, Folder } from "@/types/content";
import { makeMarkdownFileName, slugifyTitle } from "@/lib/markdown";
import { getDescendantFolderIds } from "@/lib/tree";

export type ExportEntry = {
  path: string;
  body: string;
};

export type ExportManifest = {
  app: "Mdez";
  exportedAt: string;
  exportedFolderId: string;
  folders: Folder[];
  documents: Omit<Document, "body">[];
};

export function getDocumentExportName(document: Pick<Document, "title">) {
  return makeMarkdownFileName(document.title);
}

function folderPath(folders: Folder[], folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const segments: string[] = [];
  let current = byId.get(folderId);

  while (current) {
    segments.unshift(slugifyTitle(current.name));
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return segments.join("/");
}

function documentMetadata(document: Document): Omit<Document, "body"> {
  return {
    id: document.id,
    title: document.title,
    folderId: document.folderId,
    order: document.order,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

export function buildFolderExportEntries(folders: Folder[], documents: Document[], folderId: string): ExportEntry[] {
  const folderIds = [folderId, ...getDescendantFolderIds(folders, folderId)];

  return folderIds.flatMap((currentFolderId) =>
    documents
      .filter((document) => document.folderId === currentFolderId)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .map((document) => ({
        path: `${folderPath(folders, document.folderId as string)}/${getDocumentExportName(document)}`,
        body: document.body
      }))
  );
}

export function buildExportManifest(folders: Folder[], documents: Document[], folderId: string): ExportManifest {
  const folderIds = [folderId, ...getDescendantFolderIds(folders, folderId)];
  const selectedFolders = folders.filter((folder) => folderIds.includes(folder.id));
  const selectedDocuments = documents
    .filter((document) => document.folderId !== null && folderIds.includes(document.folderId))
    .map(documentMetadata);

  return {
    app: "Mdez",
    exportedAt: new Date().toISOString(),
    exportedFolderId: folderId,
    folders: selectedFolders,
    documents: selectedDocuments
  };
}

export async function createFolderZipBlob(folders: Folder[], documents: Document[], folderId: string) {
  const zip = new JSZip();
  const rootFolder = folders.find((folder) => folder.id === folderId);

  if (!rootFolder) {
    throw new Error("Folder not found for export.");
  }

  for (const entry of buildFolderExportEntries(folders, documents, folderId)) {
    zip.file(entry.path, entry.body);
  }

  zip.file(`${slugifyTitle(rootFolder.name)}/manifest.json`, JSON.stringify(buildExportManifest(folders, documents, folderId), null, 2));

  return zip.generateAsync({ type: "blob" });
}
