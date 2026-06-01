import type { Document, Folder } from "@/types/content";

export type FolderNode = {
  folder: Folder;
  children: FolderNode[];
};

function byOrderThenName(a: Folder, b: Folder) {
  return a.order - b.order || a.name.localeCompare(b.name);
}

export function buildFolderTree(folders: Folder[], parentId: string | null = null): FolderNode[] {
  return buildFolderTreeFrom(folders, parentId, parentId === null ? new Set<string>() : new Set([parentId]));
}

function buildFolderTreeFrom(folders: Folder[], parentId: string | null, visited: Set<string>): FolderNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .filter((folder) => !visited.has(folder.id))
    .sort(byOrderThenName)
    .map((folder) => ({
      folder,
      children: buildFolderTreeFrom(folders, folder.id, new Set([...visited, folder.id]))
    }));
}

export function getDescendantFolderIds(folders: Folder[], folderId: string): string[] {
  return getDescendantFolderIdsFrom(folders, folderId, new Set([folderId]));
}

function getDescendantFolderIdsFrom(folders: Folder[], folderId: string, visited: Set<string>): string[] {
  const children = folders
    .filter((folder) => folder.parentId === folderId)
    .filter((folder) => !visited.has(folder.id))
    .sort(byOrderThenName);

  return children.flatMap((folder) => [folder.id, ...getDescendantFolderIdsFrom(folders, folder.id, new Set([...visited, folder.id]))]);
}

export function folderHasContent(folders: Folder[], documents: Document[], folderId: string): boolean {
  const ids = [folderId, ...getDescendantFolderIds(folders, folderId)];
  return folders.some((folder) => folder.parentId === folderId && folder.id !== folderId) || documents.some((document) => ids.includes(document.folderId ?? ""));
}
