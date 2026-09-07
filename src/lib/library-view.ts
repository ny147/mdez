import type { Document, Folder } from "@/types/content";

export type LibraryFilter = "all" | "recent" | "bookmarks" | "unsorted";

export type LibraryViewInput = {
  documents: Document[];
  folders: Folder[];
  selectedFolderId: string | null;
  filter: LibraryFilter;
  query: string;
  bookmarkedIds: ReadonlySet<string>;
  lastOpenedDocumentId: string | null;
};

const byRecentThenId = (left: Document, right: Document) =>
  right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);

const byFolderOrderThenName = (left: Folder, right: Folder) =>
  left.order - right.order || left.name.localeCompare(right.name) || left.id.localeCompare(right.id);

export function selectLibraryView(input: LibraryViewInput): {
  pages: Document[];
  books: Folder[];
  resumePage: Document | null;
} {
  const normalizedQuery = input.query.trim().toLocaleLowerCase("en-US");
  const resumePage = input.lastOpenedDocumentId
    ? input.documents.find((document) => document.id === input.lastOpenedDocumentId) ?? null
    : null;

  if (normalizedQuery) {
    return {
      pages: input.documents
        .filter((document) => `${document.title}\n${document.body}`.toLocaleLowerCase("en-US").includes(normalizedQuery))
        .sort(byRecentThenId),
      books: input.folders
        .filter((folder) => folder.name.toLocaleLowerCase("en-US").includes(normalizedQuery))
        .sort(byFolderOrderThenName),
      resumePage
    };
  }

  const books = input.filter === "all"
    ? input.folders.filter((folder) => folder.parentId === input.selectedFolderId).sort(byFolderOrderThenName)
    : [];
  let pages: Document[];

  switch (input.filter) {
    case "recent":
      pages = [...input.documents];
      break;
    case "bookmarks":
      pages = input.documents.filter((document) => input.bookmarkedIds.has(document.id));
      break;
    case "unsorted":
      pages = input.documents.filter((document) => document.folderId === null);
      break;
    default:
      pages = input.selectedFolderId === null
        ? [...input.documents]
        : input.documents.filter((document) => document.folderId === input.selectedFolderId);
  }

  return { pages: pages.sort(byRecentThenId), books, resumePage };
}

export function getCoverVariant(folderId: string): 0 | 1 | 2 | 3 {
  let hash = 2166136261;
  for (const character of folderId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 4) as 0 | 1 | 2 | 3;
}

export function estimateReadingMinutes(body: string): number {
  const words = body.trim() ? body.trim().split(/\s+/u).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

export function getBookPath(folderId: string | null, folders: Folder[]): string {
  if (folderId === null) return "Unsorted pages";
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: string[] = [];
  const visited = new Set<string>();
  let currentId: string | null = folderId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = byId.get(currentId);
    if (!folder) return path.length ? path.reverse().join(" / ") : "Missing book";
    path.push(folder.name);
    currentId = folder.parentId;
  }

  return path.reverse().join(" / ") || "Missing book";
}
