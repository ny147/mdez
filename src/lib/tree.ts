import type { Document, Folder } from "@/types/content";

export type FolderNode = {
  folder: Folder;
  children: FolderNode[];
};

function byOrderThenName(a: Folder, b: Folder) {
  return a.order - b.order || a.name.localeCompare(b.name);
}

export function buildFolderTree(folders: Folder[], parentId: string | null = null): FolderNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort(byOrderThenName)
    .map((folder) => ({
      folder,
      children: buildFolderTree(folders, folder.id)
    }));
}

export function getDescendantFolderIds(folders: Folder[], folderId: string): string[] {
  const children = folders.filter((folder) => folder.parentId === folderId).sort(byOrderThenName);

  return children.flatMap((folder) => [folder.id, ...getDescendantFolderIds(folders, folder.id)]);
}

export function folderHasContent(folders: Folder[], documents: Document[], folderId: string) {
  const ids = [folderId, ...getDescendantFolderIds(folders, folderId)];
  return folders.some((folder) => folder.parentId === folderId) || documents.some((document) => ids.includes(document.folderId ?? ""));
}
