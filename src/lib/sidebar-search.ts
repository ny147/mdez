import { WORKSPACE_COPY } from "@/lib/workspace-copy";
import type { Document, Folder } from "@/types/content";

const MAX_QUERY_LENGTH = 200;
const MAX_BOOK_RESULTS = 20;
const MAX_PAGE_RESULTS = 50;

export type SidebarSearchResult = {
  books: Array<{ folder: Folder; path: string; directPageCount: number }>;
  pages: Array<{ document: Document; bookPath: string }>;
  totalBookMatches: number;
  totalPageMatches: number;
  truncated: boolean;
};

export function normalizeSidebarQuery(value: string) {
  return value
    .slice(0, MAX_QUERY_LENGTH)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function getBookPath(folders: Folder[], folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current = byId.get(folderId);

  while (current && !visited.has(current.id)) {
    names.unshift(current.name);
    visited.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return names.join(" / ");
}

export function searchSidebar(folders: Folder[], documents: Document[], query: string): SidebarSearchResult {
  const normalizedQuery = normalizeSidebarQuery(query);

  if (!normalizedQuery) {
    return { books: [], pages: [], totalBookMatches: 0, totalPageMatches: 0, truncated: false };
  }

  const bookMatches = folders
    .filter((folder) => normalizeSidebarQuery(folder.name).includes(normalizedQuery))
    .map((folder) => ({
      folder,
      path: getBookPath(folders, folder.id),
      directPageCount: documents.filter((document) => document.folderId === folder.id).length
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.folder.order - b.folder.order);

  const pageMatches = documents
    .filter((document) => normalizeSidebarQuery(document.title).includes(normalizedQuery))
    .map((document) => ({
      document,
      bookPath: document.folderId ? getBookPath(folders, document.folderId) : WORKSPACE_COPY.pagesWithoutBook
    }))
    .sort((a, b) => Date.parse(b.document.updatedAt) - Date.parse(a.document.updatedAt) || a.document.title.localeCompare(b.document.title));

  return {
    books: bookMatches.slice(0, MAX_BOOK_RESULTS),
    pages: pageMatches.slice(0, MAX_PAGE_RESULTS),
    totalBookMatches: bookMatches.length,
    totalPageMatches: pageMatches.length,
    truncated: bookMatches.length > MAX_BOOK_RESULTS || pageMatches.length > MAX_PAGE_RESULTS
  };
}
