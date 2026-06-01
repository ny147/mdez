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

function byOrderThenNameThenId(a: Folder, b: Folder) {
  return a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function validateExportRoot(folders: Folder[], folderId: string) {
  const rootFolder = folders.find((folder) => folder.id === folderId);

  if (!rootFolder) {
    throw new Error("Folder not found for export.");
  }

  return rootFolder;
}

function folderSegment(folders: Folder[], folder: Folder) {
  const baseSegment = slugifyTitle(folder.name);
  const matchingSiblings = folders
    .filter((sibling) => sibling.parentId === folder.parentId)
    .sort(byOrderThenNameThenId)
    .filter((sibling) => slugifyTitle(sibling.name) === baseSegment);
  const segmentIndex = matchingSiblings.findIndex((sibling) => sibling.id === folder.id);

  return segmentIndex > 0 ? `${baseSegment}-${segmentIndex + 1}` : baseSegment;
}

function folderPath(folders: Folder[], folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const segments: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(folderId);

  while (current) {
    if (visited.has(current.id)) {
      throw new Error("Folder cycle detected while building export path.");
    }

    visited.add(current.id);
    segments.unshift(folderSegment(folders, current));
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
  validateExportRoot(folders, folderId);

  const folderIds = [folderId, ...getDescendantFolderIds(folders, folderId)];
  const usedPaths = new Set<string>();

  return folderIds.flatMap((currentFolderId) =>
    documents
      .filter((document) => document.folderId === currentFolderId)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
      .map((document) => {
        const basePath = folderPath(folders, document.folderId as string);
        const baseName = slugifyTitle(document.title);
        let fileName = `${baseName}.md`;
        let path = `${basePath}/${fileName}`;
        let suffix = 2;

        while (usedPaths.has(path)) {
          fileName = `${baseName}-${suffix}.md`;
          path = `${basePath}/${fileName}`;
          suffix += 1;
        }

        usedPaths.add(path);

        return {
          path,
          body: document.body
        };
      })
  );
}

export function buildExportManifest(folders: Folder[], documents: Document[], folderId: string): ExportManifest {
  validateExportRoot(folders, folderId);

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
  const rootFolder = validateExportRoot(folders, folderId);

  for (const entry of buildFolderExportEntries(folders, documents, folderId)) {
    zip.file(entry.path, entry.body);
  }

  zip.file(`${folderPath(folders, rootFolder.id)}/manifest.json`, JSON.stringify(buildExportManifest(folders, documents, folderId), null, 2));

  return zip.generateAsync({ type: "blob" });
}
