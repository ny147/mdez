import type { Document, Folder } from "@/types/content";
import type { LocalGroupCreation } from "@/types/key-group";

export function buildLocalGroupCreation(
  name: string,
  key: string,
  folders: Folder[],
  documents: Document[],
): LocalGroupCreation {
  return {
    key,
    import: {
      name: name.trim(),
      folders: folders.map((folder) => ({
        clientId: folder.id,
        parentClientId: folder.parentId,
        name: folder.name,
        order: folder.order,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })),
      documents: documents.map((document) => ({
        clientId: document.id,
        folderClientId: document.folderId,
        title: document.title,
        body: document.body,
        order: document.order,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      })),
    },
  };
}
