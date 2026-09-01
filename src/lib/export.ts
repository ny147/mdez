import JSZip from "jszip";
import type { Document, Folder } from "@/types/content";
import { fileNameToTitle, makeMarkdownFileName, slugifyTitle } from "@/lib/markdown";
import { getDescendantFolderIds } from "@/lib/tree";

export type ExportEntry = {
  path: string;
  body: string;
};

export type WorkspaceExportEntry = ExportEntry & { documentId: string };

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
  const usedSegments = new Set<string>();
  const siblings = folders
    .filter((sibling) => sibling.parentId === folder.parentId)
    .sort(byOrderThenNameThenId);

  for (const sibling of siblings) {
    const baseSegment = slugifyTitle(sibling.name);
    let segment = baseSegment;
    let suffix = 2;

    while (usedSegments.has(segment)) {
      segment = `${baseSegment}-${suffix}`;
      suffix += 1;
    }

    if (sibling.id === folder.id) {
      return segment;
    }

    usedSegments.add(segment);
  }

  return slugifyTitle(folder.name);
}

function folderPath(folders: Folder[], folderId: string, exportRootId: string) {
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

    if (current.id === exportRootId) {
      if (current.parentId === current.id) {
        throw new Error("Folder cycle detected while building export path.");
      }

      return segments.join("/");
    }

    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  throw new Error("Folder path does not include export root.");
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
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
      .map((document) => {
        const basePath = folderPath(folders, document.folderId as string, folderId);
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

export function buildWorkspaceExportEntries(folders: Folder[], documents: Document[]): WorkspaceExportEntry[] {
  const roots = new Map(folders.filter((folder) => folder.parentId === null).map((folder) => [folder.id, folder]));
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const usedPaths = new Set<string>();

  function pathFor(document: Document) {
    if (document.folderId === null) return "pages-without-book";
    let current = byId.get(document.folderId);
    const visited = new Set<string>();
    while (current?.parentId !== null) {
      if (!current || visited.has(current.id)) throw new Error("Folder cycle detected while building export path.");
      visited.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (!current || !roots.has(current.id)) throw new Error("Folder path does not include a workspace root.");
    return folderPath(folders, document.folderId, current.id);
  }

  return [...documents]
    .sort((a, b) => pathFor(a).localeCompare(pathFor(b)) || a.order - b.order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map((document) => {
      const directory = pathFor(document);
      const baseName = slugifyTitle(fileNameToTitle(document.title));
      let path = `${directory}/${baseName}.md`;
      let suffix = 2;
      while (usedPaths.has(path)) {
        path = `${directory}/${baseName}-${suffix}.md`;
        suffix += 1;
      }
      usedPaths.add(path);
      return { documentId: document.id, path, body: document.body };
    });
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

  zip.file(`${folderPath(folders, rootFolder.id, rootFolder.id)}/manifest.json`, JSON.stringify(buildExportManifest(folders, documents, folderId), null, 2));

  return zip.generateAsync({ type: "blob" });
}
