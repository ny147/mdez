import type { Document, Folder } from "@/types/content";

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export const UNSORTED_COLLECTION_ID = "__mdez_unsorted__";

export function naturalCompare(left: string, right: string): number {
  return collator.compare(left, right);
}

export function sortBooks(folders: Folder[]): Folder[] {
  return [...folders].sort((left, right) => naturalCompare(left.name, right.name) || left.id.localeCompare(right.id));
}

export function sortPages(documents: Document[]): Document[] {
  return [...documents].sort((left, right) => naturalCompare(left.title, right.title) || left.id.localeCompare(right.id));
}

export function buildFlatBookMigration(folders: Folder[]): Array<{ id: string; name: string }> {
  const byId = new Map(folders.map((item) => [item.id, item]));
  const reserved = new Set(folders.filter((item) => item.parentId === null).map((item) => item.name.trim().toLocaleLowerCase()));

  function pathFor(folder: Folder): string {
    const names = [folder.name.trim() || "Untitled Book"];
    const visited = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      names.unshift(parent.name.trim() || "Untitled Book");
      if (visited.has(parent.id)) break;
      visited.add(parent.id);
      parentId = parent.parentId;
    }
    return names.join(" / ");
  }

  return folders.map((folder) => {
    if (folder.parentId === null) return { id: folder.id, name: folder.name };
    const base = pathFor(folder);
    let name = base;
    let suffix = 2;
    while (reserved.has(name.toLocaleLowerCase())) name = `${base} (${suffix++})`;
    reserved.add(name.toLocaleLowerCase());
    return { id: folder.id, name };
  });
}

export function groupPagesByCollection(folders: Folder[], documents: Document[]) {
  const pages = new Map<string | null, Document[]>();
  pages.set(null, []);
  for (const folder of folders) pages.set(folder.id, []);
  for (const document of documents) (pages.get(document.folderId) ?? pages.get(null)!).push(document);
  for (const [key, value] of pages) pages.set(key, sortPages(value));
  return pages;
}
